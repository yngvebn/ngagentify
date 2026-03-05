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
  | { type: 'annotation:delete'; id: string }
  | { type: 'annotations:clear' }
  | { type: 'session:yolo-toggle' }
  | { type: 'diff:approved'; id: string }
  | { type: 'diff:rejected'; id: string };

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(data), (err) => { if (err) { /* connection closed mid-send */ } });
}

export function createWsHandler(server: ViteDevServer, getManifest: () => Record<string, unknown>): void {
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
      server.config.logger.info(`[ng-annotate] WS connected, url=${req.url ?? '(none)'}`);

      let reqUrlParsed: URL;
      try {
        reqUrlParsed = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      } catch (err) {
        server.config.logger.error(`[ng-annotate] Failed to parse WS URL "${req.url ?? ''}": ${String(err)}`);
        return;
      }
      const existingSessionId = reqUrlParsed.searchParams.get('sessionId');
      server.config.logger.info(`[ng-annotate] existingSessionId=${existingSessionId ?? '(none)'}`);

      let sessionId: string;
      try {
        let session = existingSessionId ? await store.getSession(existingSessionId) : undefined;
        server.config.logger.info(`[ng-annotate] session lookup: ${session ? 'found' : 'not found'}`);
        if (session) {
          session = await store.updateSession(session.id, { active: true, lastSeenAt: new Date().toISOString() }) ?? session;
        } else {
          session = await store.createSession({ active: true, url: referer });
        }
        sessionId = session.id;
        server.config.logger.info(`[ng-annotate] session ready: ${sessionId}`);
        safeSend(ws, { type: 'session:created', session });
        safeSend(ws, { type: 'manifest:update', manifest: getManifest() });
        // Immediately sync existing annotations for restored sessions
        const annotations = await store.listAnnotations(sessionId);
        server.config.logger.info(`[ng-annotate] syncing ${annotations.length} annotations`);
        safeSend(ws, { type: 'annotations:sync', annotations, lastAgentHeartbeat: store.getHeartbeat() });
        sessionSockets.set(sessionId, ws);
      } catch (err) {
        server.config.logger.error(`[ng-annotate] Failed to create session: ${String(err)}`);
        return;
      }

      ws.on('message', (raw: Buffer) => {
        void (async () => {
          let msg: MessageType;
          try {
            msg = JSON.parse(raw.toString()) as MessageType;
          } catch {
            return;
          }

          try {
            if (msg.type === 'annotation:create') {
              const annotation = await store.createAnnotation({
                ...(msg.payload as Parameters<typeof store.createAnnotation>[0]),
                sessionId,
              });
              safeSend(ws, { type: 'annotation:created', annotation });
            } else if (msg.type === 'annotation:reply') {
              const annotation = await store.addReply(msg.id, { author: 'user', message: msg.message });
              if (annotation) safeSend(ws, { type: 'annotation:updated', annotation });
            } else if (msg.type === 'session:yolo-toggle') {
              const current = await store.getSession(sessionId);
              const updated = await store.updateSession(sessionId, { yoloMode: !(current?.yoloMode ?? false) });
              if (updated) safeSend(ws, { type: 'session:updated', session: updated });
            } else if (msg.type === 'annotations:clear') {
              await store.clearAnnotations(sessionId);
              safeSend(ws, { type: 'annotations:sync', annotations: [] });
            } else if (msg.type === 'diff:approved') {
              await store.updateAnnotation(msg.id, { diffResponse: 'approved' });
            } else if (msg.type === 'diff:rejected') {
              await store.updateAnnotation(msg.id, { diffResponse: 'rejected' });
            } else {
              const annotation = await store.updateAnnotation(msg.id, { status: 'dismissed' });
              if (annotation) safeSend(ws, { type: 'annotation:updated', annotation });
            }
          } catch (err) {
            server.config.logger.error(`[ng-annotate] Failed to process message: ${String(err)}`);
          }
        })();
      });

      ws.on('close', () => {
        void store.updateSession(sessionId, { active: false });
        if (sessionSockets.get(sessionId) === ws) {
          sessionSockets.delete(sessionId);
        }
      });
    })();
  });

  // Sync annotation status updates back to browsers every 2s
  setInterval(() => {
    void (async () => {
      for (const [sessionId, ws] of sessionSockets) {
        if (ws.readyState !== WebSocket.OPEN) continue;
        const annotations = await store.listAnnotations(sessionId);
        safeSend(ws, { type: 'annotations:sync', annotations, lastAgentHeartbeat: store.getHeartbeat() });
      }
    })();
  }, SYNC_INTERVAL_MS);
}
