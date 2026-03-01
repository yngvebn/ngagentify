import { createBuilder } from '@angular-devkit/architect';
import { executeDevServerBuilder } from '@angular/build';
import type { DevServerBuilderOptions } from '@angular/build';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import ts from 'typescript';

interface NgAnnotateDevServerOptions extends DevServerBuilderOptions {
  ngAnnotateDebug?: boolean;
}

// ─── Logging ──────────────────────────────────────────────────────────────────

function makeLogger(debug: boolean) {
  return {
    info: (msg: string) => process.stderr.write(`[ng-annotate] ${msg}\n`),
    debug: (msg: string) => { if (debug) process.stderr.write(`[ng-annotate:debug] ${msg}\n`); },
  };
}

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

type Logger = ReturnType<typeof makeLogger>;

function makeStore(projectRoot: string, log: Logger) {
  const storePath = path.join(projectRoot, STORE_DIR, 'store.json');
  log.debug(`store path: ${storePath}`);

  function ensureStore(): void {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log.debug(`created store directory: ${dir}`);
    }
    if (!fs.existsSync(storePath)) {
      fs.writeFileSync(storePath, JSON.stringify({ sessions: {}, annotations: {} }, null, 2), 'utf8');
      log.debug(`initialized store file: ${storePath}`);
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
      log.debug(`session created: ${session.id} (url: ${url || '(none)'})`);
      return session;
    },

    async updateSession(id: string, patch: Partial<Session>): Promise<void> {
      await withLock<StoreData>((data) => {
        const s = data.sessions[id];
        if (s) data.sessions[id] = { ...s, ...patch, id };
        return data;
      });
      log.debug(`session updated: ${id} patch=${JSON.stringify(patch)}`);
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
      log.debug(`annotation created: ${annotation.id} (session: ${payload.sessionId})`);
      return annotation;
    },

    listAnnotations(sessionId: string): Annotation[] {
      const data = readStore();
      const result = Object.values(data.annotations)
        .filter((a): a is Annotation => a?.sessionId === sessionId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      log.debug(`listAnnotations(${sessionId}): ${String(result.length)} annotation(s)`);
      return result;
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
      log.debug(`reply added to annotation ${annotationId} by ${reply.author}`);
      return result;
    },
  };
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

interface ManifestEntry {
  component: string;
  template?: string;
}

/**
 * Find the tsconfig used for the project build, by reading angular.json.
 * Falls back to tsconfig.app.json or tsconfig.json in the workspace root.
 */
function findTsConfig(workspaceRoot: string, projectName: string | undefined, log: Logger): string | undefined {
  const angularJsonPath = path.join(workspaceRoot, 'angular.json');
  if (fs.existsSync(angularJsonPath) && projectName) {
    try {
      const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8')) as {
        projects?: Record<string, { architect?: { build?: { options?: { tsConfig?: string } } } } | undefined>;
      };
      const tsConfigRel = angularJson.projects?.[projectName]?.architect?.build?.options?.tsConfig;
      if (tsConfigRel) {
        const resolved = path.resolve(workspaceRoot, tsConfigRel);
        log.debug(`tsconfig from angular.json[${projectName}]: ${resolved}`);
        return resolved;
      }
    } catch { /* ignore */ }
  }

  for (const name of ['tsconfig.app.json', 'tsconfig.json']) {
    const p = path.join(workspaceRoot, name);
    if (fs.existsSync(p)) {
      log.debug(`tsconfig fallback: ${p}`);
      return p;
    }
  }
  log.debug('no tsconfig found — manifest will be empty');
  return undefined;
}

/**
 * Build the component manifest by parsing the tsconfig and scanning the
 * resolved file list. Respects include/exclude/files settings — no hardcoded
 * directory conventions.
 */
function buildManifest(tsConfigPath: string, workspaceRoot: string, log: Logger): Record<string, ManifestEntry> {
  const manifest: Record<string, ManifestEntry> = {};

  const readResult = ts.readConfigFile(tsConfigPath, (f) => ts.sys.readFile(f));
  if (readResult.error) {
    log.debug(`ts.readConfigFile error: ${ts.flattenDiagnosticMessageText(readResult.error.messageText, '\n')}`);
    return manifest;
  }

  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path.dirname(tsConfigPath),
  );

  const tsFiles = parsed.fileNames.filter(
    f => f.endsWith('.ts') && !f.endsWith('.spec.ts') && !f.endsWith('.d.ts'),
  );
  log.debug(`tsconfig resolved ${String(tsFiles.length)} TS file(s) to scan`);

  let scanned = 0;
  for (const file of tsFiles) {
    let code: string;
    try { code = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (!code.includes('@Component')) continue;

    const classMatch = /export\s+class\s+(\w+)/.exec(code);
    if (!classMatch) continue;

    const relPath = path.relative(workspaceRoot, file).replace(/\\/g, '/');
    const item: ManifestEntry = { component: relPath };

    const templateMatch = /templateUrl\s*:\s*['"`]([^'"`]+)['"`]/.exec(code);
    if (templateMatch) {
      const templateAbs = path.resolve(path.dirname(file), templateMatch[1]);
      item.template = path.relative(workspaceRoot, templateAbs).replace(/\\/g, '/');
    }

    manifest[classMatch[1]] = item;
    scanned++;
    log.debug(`  component found: ${classMatch[1]} → ${relPath}`);
  }

  log.debug(`manifest built: ${String(scanned)} component(s)`);
  return manifest;
}

// ─── WebSocket handler ────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 2000;

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(data), (err) => { if (err) { /* connection closed mid-send */ } });
}

function createAnnotateWsHandler(
  store: ReturnType<typeof makeStore>,
  getManifest: () => Record<string, ManifestEntry>,
  log: Logger,
) {
  const wss = new WebSocketServer({ noServer: true });
  const sessionSockets = new Map<string, WebSocket>();

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    void (async () => {
      const url = req.headers.referer ?? req.headers.origin ?? '';
      log.debug(`WS connection from: ${url}`);
      let sessionId: string;
      try {
        const session = await store.createSession(url);
        sessionId = session.id;
        safeSend(ws, { type: 'session:created', session });
        const manifest = getManifest();
        safeSend(ws, { type: 'manifest:update', manifest });
        log.debug(`WS session:created → ${sessionId}, sent manifest with ${String(Object.keys(manifest).length)} component(s)`);
        sessionSockets.set(sessionId, ws);
      } catch (err) {
        log.info(`Failed to create session: ${String(err)}`);
        return;
      }

      ws.on('message', (raw: Buffer) => {
        void (async () => {
          let msg: { type: string; payload?: Record<string, unknown>; id?: string; message?: string };
          try { msg = JSON.parse(raw.toString()) as typeof msg; } catch { return; }
          log.debug(`WS message received: type=${msg.type}`);

          try {
            if (msg.type === 'annotation:create' && msg.payload) {
              const annotation = await store.createAnnotation({ ...msg.payload, sessionId });
              safeSend(ws, { type: 'annotation:created', annotation });
            } else if (msg.type === 'annotation:reply' && msg.id && msg.message) {
              const updated = await store.addReply(msg.id, { author: 'user', message: msg.message });
              if (updated) safeSend(ws, { type: 'annotation:updated', annotation: updated });
            }
          } catch (err) {
            log.info(`Failed to process message: ${String(err)}`);
          }
        })();
      });

      ws.on('close', () => {
        log.debug(`WS closed: session ${sessionId}`);
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

  function broadcastManifest(manifest: Record<string, ManifestEntry>): void {
    log.debug(`broadcasting manifest:update to ${String(sessionSockets.size)} session(s), ${String(Object.keys(manifest).length)} component(s)`);
    for (const ws of sessionSockets.values()) {
      safeSend(ws, { type: 'manifest:update', manifest });
    }
  }

  return { wss, broadcastManifest };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export default createBuilder<NgAnnotateDevServerOptions>((options, context) => {
  const { ngAnnotateDebug, ...devServerOptions } = options;
  const debug = ngAnnotateDebug ?? false;
  const log = makeLogger(debug);

  const workspaceRoot = context.workspaceRoot;
  const projectRoot = findStoreRoot(workspaceRoot);
  const projectName = context.target?.project;

  log.info(`starting (project: ${projectName ?? '(unknown)'}, workspaceRoot: ${workspaceRoot})`);
  log.debug(`storeRoot: ${projectRoot}`);
  log.debug(`debug logging: enabled`);

  const store = makeStore(projectRoot, log);

  const tsConfigPath = findTsConfig(workspaceRoot, projectName, log);
  let manifest: Record<string, ManifestEntry> = tsConfigPath
    ? buildManifest(tsConfigPath, workspaceRoot, log)
    : {};

  log.info(`manifest ready: ${String(Object.keys(manifest).length)} component(s)`);

  const { wss, broadcastManifest } = createAnnotateWsHandler(store, () => manifest, log);

  // Watch for component file changes and rebuild the manifest from tsconfig.
  if (tsConfigPath) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      fs.watch(path.dirname(tsConfigPath), { recursive: true }, (_, filename) => {
        if (!filename?.endsWith('.ts') || filename.endsWith('.spec.ts')) return;
        log.debug(`file change detected: ${filename} — debouncing manifest rebuild`);
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          log.debug(`rebuilding manifest after file change`);
          manifest = buildManifest(tsConfigPath, workspaceRoot, log);
          broadcastManifest(manifest);
        }, 200);
      });
      log.debug(`watching for TS changes in: ${path.dirname(tsConfigPath)}`);
    } catch {
      log.debug(`fs.watch with recursive not supported on this platform — manifest will not auto-update`);
    }
  }

  let wsAttached = false;

  const middleware = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: (err?: unknown) => void,
  ): void => {
    if (req.url === '/__annotate/manifest' && req.method === 'GET') {
      log.debug(`GET /__annotate/manifest → ${String(Object.keys(manifest).length)} component(s)`);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(manifest));
      return;
    }

    if (!wsAttached) {
      wsAttached = true;
      const httpServer = (req.socket as unknown as { server: http.Server }).server;
      httpServer.on('upgrade', (upgradeReq: http.IncomingMessage, socket, head: Buffer) => {
        if (upgradeReq.url === '/__annotate') {
          log.debug(`WS upgrade request from: ${upgradeReq.headers.origin ?? '(unknown)'}`);
          wss.handleUpgrade(upgradeReq, socket, head, (ws) => {
            wss.emit('connection', ws, upgradeReq);
          });
        }
      });
      log.info(`WebSocket handler attached to Angular dev server`);
    }
    next();
  };

  const indexHtmlTransformer = (content: string): Promise<string> => {
    log.debug(`indexHtmlTransformer: injecting empty manifest placeholder`);
    const script = `<script>window.__NG_ANNOTATE_MANIFEST__ = {};</script>`;
    return Promise.resolve(content.replace('</head>', `  ${script}\n</head>`));
  };

  return executeDevServerBuilder(devServerOptions, context, {
    middleware: [middleware],
    indexHtmlTransformer,
  }) as AsyncIterable<{ success: boolean }>;
});
