import { WebSocketServer, WebSocket } from 'ws';
import type { Duplex } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import type { ViteDevServer } from 'vite';
import { store } from './store.js';

const WS_PATH = '/__annotate';
const SYNC_INTERVAL_MS = 2000;

type MessageType =
  | { type: 'annotation:create'; payload: Record<string, unknown> }
  | { type: 'annotation:reply'; id: string; message: string }
  | { type: 'annotation:delete'; id: string };

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(data), (err) => { if (err) { /* connection closed mid-send */ } });
}

export function createWsHandler(server: ViteDevServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const sessionSockets = new Map<string, WebSocket>();

  // Upgrade only /__annotate connections
  server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = req.url ?? '';
    if (!url.startsWith(WS_PATH)) return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    void (async () => {
      const referer = req.headers.referer ?? req.headers.origin ?? '';

      const session = await store.createSession({ active: true, url: referer });
      const sessionId = session.id;

      safeSend(ws, { type: 'session:created', session });
      sessionSockets.set(sessionId, ws);

      ws.on('message', (raw: Buffer) => {
        void (async () => {
          let msg: MessageType;
          try {
            msg = JSON.parse(raw.toString()) as MessageType;
          } catch {
            return;
          }

          if (msg.type === 'annotation:create') {
            const annotation = await store.createAnnotation({
              ...(msg.payload as Parameters<typeof store.createAnnotation>[0]),
              sessionId,
            });
            safeSend(ws, { type: 'annotation:created', annotation });
          } else if (msg.type === 'annotation:reply') {
            const annotation = await store.addReply(msg.id, { author: 'user', message: msg.message });
            if (annotation) {
              safeSend(ws, { type: 'annotation:updated', annotation });
            }
          } else {
            const annotation = await store.updateAnnotation(msg.id, { status: 'dismissed' });
            if (annotation) {
              safeSend(ws, { type: 'annotation:updated', annotation });
            }
          }
        })();
      });

      ws.on('close', () => {
        void store.updateSession(sessionId, { active: false });
        sessionSockets.delete(sessionId);
      });
    })();
  });

  // Sync annotation status updates back to browsers every 2s
  setInterval(() => {
    void (async () => {
      for (const [sessionId, ws] of sessionSockets) {
        if (ws.readyState !== WebSocket.OPEN) continue;
        const annotations = await store.listAnnotations(sessionId);
        safeSend(ws, { type: 'annotations:sync', annotations });
      }
    })();
  }, SYNC_INTERVAL_MS);
}
