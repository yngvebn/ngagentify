import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { store } from './store.js';

const PORT = 4201;
const SYNC_INTERVAL_MS = 2000;

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
      if (entry.isDirectory()) {
        scan(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;

      const code = fs.readFileSync(fullPath, 'utf8');
      if (!code.includes('@Component')) continue;

      const classMatch = /export\s+class\s+(\w+)/.exec(code);
      if (!classMatch) continue;
      const className = classMatch[1];

      const relPath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');
      const item: ManifestEntry = { component: relPath };

      const templateMatch = /templateUrl\s*:\s*['"`]([^'"`]+)['"`]/.exec(code);
      if (templateMatch) {
        const templateAbs = path.resolve(path.dirname(fullPath), templateMatch[1]);
        item.template = path.relative(projectRoot, templateAbs).replace(/\\/g, '/');
      }

      manifest[className] = item;
    }
  }

  scan(srcDir);
  return manifest;
}

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(data), (err) => {
    if (err) { /* connection closed mid-send */ }
  });
}

export function startWsServer(): void {
  const projectRoot = process.env.NG_ANNOTATE_PROJECT_ROOT ?? process.cwd();
  const sessionSockets = new Map<string, WebSocket>();
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    void (async () => {
      const referer = req.headers.referer ?? req.headers.origin ?? '';

      let sessionId: string;
      try {
        const session = await store.createSession({ active: true, url: referer });
        sessionId = session.id;
        safeSend(ws, { type: 'session:created', session });

        const manifest = buildManifest(projectRoot);
        safeSend(ws, { type: 'manifest:update', manifest });

        sessionSockets.set(sessionId, ws);
      } catch (err) {
        process.stderr.write(`[ng-annotate] Failed to create session: ${String(err)}\n`);
        return;
      }

      ws.on('message', (raw: Buffer) => {
        void (async () => {
          let msg: { type: string; payload?: Record<string, unknown>; id?: string; message?: string };
          try {
            msg = JSON.parse(raw.toString()) as typeof msg;
          } catch {
            return;
          }

          try {
            if (msg.type === 'annotation:create' && msg.payload) {
              const annotation = await store.createAnnotation({
                ...(msg.payload as Parameters<typeof store.createAnnotation>[0]),
                sessionId,
              });
              safeSend(ws, { type: 'annotation:created', annotation });
            } else if (msg.type === 'annotation:reply' && msg.id && msg.message) {
              const annotation = await store.addReply(msg.id, { author: 'user', message: msg.message });
              if (annotation) safeSend(ws, { type: 'annotation:updated', annotation });
            } else if (msg.id) {
              const annotation = await store.updateAnnotation(msg.id, { status: 'dismissed' });
              if (annotation) safeSend(ws, { type: 'annotation:updated', annotation });
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
    void (async () => {
      for (const [sessionId, ws] of sessionSockets) {
        if (ws.readyState !== WebSocket.OPEN) continue;
        const annotations = await store.listAnnotations(sessionId);
        safeSend(ws, { type: 'annotations:sync', annotations });
      }
    })();
  }, SYNC_INTERVAL_MS);

  const server = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });

  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/__annotate') return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  server.listen(PORT, () => {
    process.stderr.write(`[ng-annotate] WebSocket server listening on port ${String(PORT)}\n`);
  });
}
