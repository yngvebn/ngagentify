import { createBuilder } from '@angular-devkit/architect';
import { executeDevServerBuilder } from '@angular/build';
import type { DevServerBuilderOptions } from '@angular/build';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

// ─── Store ────────────────────────────────────────────────────────────────────

const STORE_DIR = '.ng-annotate';

/** Walk up from startDir until we find a .git folder; return that dir or startDir. */
function findStoreRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  let parent = path.dirname(dir);
  while (parent !== dir) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = parent;
    parent = path.dirname(dir);
  }
  return startDir;
}

interface Session {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  active: boolean;
  url: string;
}

interface AnnotationReply {
  id: string;
  createdAt: string;
  author: 'agent' | 'user';
  message: string;
}

interface Annotation {
  id: string;
  sessionId: string;
  createdAt: string;
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  replies: AnnotationReply[];
  [key: string]: unknown;
}

interface StoreData {
  sessions: Record<string, Session | undefined>;
  annotations: Record<string, Annotation | undefined>;
}

function makeStore(projectRoot: string) {
  const storePath = path.join(projectRoot, STORE_DIR, 'store.json');

  function ensureStore(): void {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(storePath)) {
      fs.writeFileSync(storePath, JSON.stringify({ sessions: {}, annotations: {} }, null, 2), 'utf8');
    }
  }

  let writeQueue: Promise<unknown> = Promise.resolve();

  async function withLock<T>(fn: (data: StoreData) => StoreData): Promise<T> {
    ensureStore();
    const result = writeQueue.then(() => {
      const raw = fs.readFileSync(storePath, 'utf8');
      const data = JSON.parse(raw) as StoreData;
      const updated = fn(data);
      fs.writeFileSync(storePath, JSON.stringify(updated, null, 2), 'utf8');
      return updated as unknown as T;
    });
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    writeQueue = result.catch(() => {});
    return result;
  }

  function readStore(): StoreData {
    ensureStore();
    return JSON.parse(fs.readFileSync(storePath, 'utf8')) as StoreData;
  }

  return {
    async createSession(url: string): Promise<Session> {
      const now = new Date().toISOString();
      const session: Session = { id: randomUUID(), createdAt: now, lastSeenAt: now, active: true, url };
      await withLock<StoreData>((data) => { data.sessions[session.id] = session; return data; });
      return session;
    },

    async updateSession(id: string, patch: Partial<Session>): Promise<void> {
      await withLock<StoreData>((data) => {
        const s = data.sessions[id];
        if (s) data.sessions[id] = { ...s, ...patch, id };
        return data;
      });
    },

    async createAnnotation(payload: Record<string, unknown> & { sessionId: string }): Promise<Annotation> {
      const annotation: Annotation = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        replies: [],
        ...payload,
      };
      await withLock<StoreData>((data) => { data.annotations[annotation.id] = annotation; return data; });
      return annotation;
    },

    listAnnotations(sessionId: string): Annotation[] {
      const data = readStore();
      return Object.values(data.annotations)
        .filter((a): a is Annotation => a?.sessionId === sessionId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async addReply(annotationId: string, reply: { author: 'agent' | 'user'; message: string }): Promise<Annotation | undefined> {
      let result: Annotation | undefined;
      await withLock<StoreData>((data) => {
        const annotation = data.annotations[annotationId];
        if (!annotation) return data;
        annotation.replies.push({ id: randomUUID(), createdAt: new Date().toISOString(), ...reply });
        result = annotation;
        return data;
      });
      return result;
    },
  };
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

interface ManifestEntry {
  component: string;
  template?: string;
}

function buildManifest(projectRoot: string): Record<string, ManifestEntry> {
  const manifest: Record<string, ManifestEntry> = {};
  const srcDir = path.join(projectRoot, 'src');
  if (!fs.existsSync(srcDir)) return manifest;

  function scan(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(fullPath); continue; }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;

      const code = fs.readFileSync(fullPath, 'utf8');
      if (!code.includes('@Component')) continue;

      const classMatch = /export\s+class\s+(\w+)/.exec(code);
      if (!classMatch) continue;

      const relPath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');
      const item: ManifestEntry = { component: relPath };
      const templateMatch = /templateUrl\s*:\s*['"`]([^'"`]+)['"`]/.exec(code);
      if (templateMatch) {
        const templateAbs = path.resolve(path.dirname(fullPath), templateMatch[1]);
        item.template = path.relative(projectRoot, templateAbs).replace(/\\/g, '/');
      }
      manifest[classMatch[1]] = item;
    }
  }

  scan(srcDir);
  return manifest;
}

// ─── WebSocket handler ────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 2000;

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(data), (err) => { if (err) { /* connection closed mid-send */ } });
}

function createAnnotateWsHandler(store: ReturnType<typeof makeStore>) {
  const wss = new WebSocketServer({ noServer: true });
  const sessionSockets = new Map<string, WebSocket>();

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    void (async () => {
      const url = req.headers.referer ?? req.headers.origin ?? '';
      let sessionId: string;
      try {
        const session = await store.createSession(url);
        sessionId = session.id;
        safeSend(ws, { type: 'session:created', session });
        sessionSockets.set(sessionId, ws);
      } catch (err) {
        process.stderr.write(`[ng-annotate] Failed to create session: ${String(err)}\n`);
        return;
      }

      ws.on('message', (raw: Buffer) => {
        void (async () => {
          let msg: { type: string; payload?: Record<string, unknown>; id?: string; message?: string };
          try { msg = JSON.parse(raw.toString()) as typeof msg; } catch { return; }

          try {
            if (msg.type === 'annotation:create' && msg.payload) {
              const annotation = await store.createAnnotation({ ...msg.payload, sessionId });
              safeSend(ws, { type: 'annotation:created', annotation });
            } else if (msg.type === 'annotation:reply' && msg.id && msg.message) {
              const updated = await store.addReply(msg.id, { author: 'user', message: msg.message });
              if (updated) safeSend(ws, { type: 'annotation:updated', annotation: updated });
            }
          } catch (err) {
            process.stderr.write(`[ng-annotate] Failed to process message: ${String(err)}\n`);
          }
        })();
      });

      ws.on('close', () => {
        void store.updateSession(sessionId, { active: false });
        sessionSockets.delete(sessionId);
      });
    })();
  });

  setInterval(() => {
    for (const [sessionId, ws] of sessionSockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const annotations = store.listAnnotations(sessionId);
      safeSend(ws, { type: 'annotations:sync', annotations });
    }
  }, SYNC_INTERVAL_MS);

  return { wss };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export default createBuilder<DevServerBuilderOptions>((options, context) => {
  const workspaceRoot = context.workspaceRoot;
  const projectRoot = findStoreRoot(workspaceRoot);
  const store = makeStore(projectRoot);
  const manifest = buildManifest(workspaceRoot);
  const { wss } = createAnnotateWsHandler(store);

  let wsAttached = false;

  const middleware = (
    req: http.IncomingMessage,
    _res: http.ServerResponse,
    next: (err?: unknown) => void,
  ): void => {
    if (!wsAttached) {
      wsAttached = true;
      const httpServer = (req.socket as unknown as { server: http.Server }).server;
      httpServer.on('upgrade', (upgradeReq: http.IncomingMessage, socket, head: Buffer) => {
        if (upgradeReq.url === '/__annotate') {
          wss.handleUpgrade(upgradeReq, socket, head, (ws) => {
            wss.emit('connection', ws, upgradeReq);
          });
        }
      });
      process.stderr.write(`[ng-annotate] WebSocket handler attached to Angular dev server\n`);
    }
    next();
  };

  const indexHtmlTransformer = (content: string): Promise<string> => {
    const script = `<script>window.__NG_ANNOTATE_MANIFEST__ = ${JSON.stringify(manifest)};</script>`;
    return Promise.resolve(content.replace('</head>', `  ${script}\n</head>`));
  };

  return executeDevServerBuilder(options, context, {
    middleware: [middleware],
    indexHtmlTransformer,
  }) as AsyncIterable<{ success: boolean }>;
});
