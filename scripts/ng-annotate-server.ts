#!/usr/bin/env tsx
/**
 * Standalone ng-annotate dev server.
 *
 * Responsibilities:
 *  1. Scan demo/src for @Component classes and write a manifest JS file to
 *     demo/public/ng-annotate-manifest.js (served as /ng-annotate-manifest.js).
 *  2. Run an HTTP+WebSocket server on port 4201; Angular's proxy forwards
 *     ws://localhost:4200/__annotate → ws://localhost:4201/__annotate.
 *
 * Run from the repo root via: npx tsx scripts/ng-annotate-server.ts
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { store } from '../packages/vite-plugin/src/store.js';

const PORT = 4201;
const REPO_ROOT = process.cwd();
const DEMO_SRC = path.join(REPO_ROOT, 'demo', 'src');
const MANIFEST_OUT = path.join(REPO_ROOT, 'demo', 'public', 'ng-annotate-manifest.js');

// ─── Manifest generation ──────────────────────────────────────────────────────

interface ManifestEntry {
  component: string;
  template?: string;
}

function buildManifest(): Record<string, ManifestEntry> {
  const manifest: Record<string, ManifestEntry> = {};

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

      const relPath = path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
      const item: ManifestEntry = { component: relPath };

      const templateMatch = /templateUrl\s*:\s*['"`]([^'"`]+)['"`]/.exec(code);
      if (templateMatch) {
        const templateAbs = path.resolve(path.dirname(fullPath), templateMatch[1]);
        item.template = path.relative(REPO_ROOT, templateAbs).replace(/\\/g, '/');
      }

      manifest[className] = item;
    }
  }

  scan(DEMO_SRC);
  return manifest;
}

function writeManifest(): void {
  const manifest = buildManifest();
  fs.mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
  fs.writeFileSync(
    MANIFEST_OUT,
    `window.__NG_ANNOTATE_MANIFEST__ = ${JSON.stringify(manifest, null, 2)};\n`,
    'utf8',
  );
  console.log(
    `[ng-annotate] manifest written — ${Object.keys(manifest).length.toString()} components`,
  );
}

// ─── WebSocket server ─────────────────────────────────────────────────────────

const SYNC_MS = 2000;
const sessionSockets = new Map<string, WebSocket>();

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  void (async () => {
    const referer = (req.headers.referer ?? req.headers.origin ?? '') as string;
    const session = await store.createSession({ active: true, url: referer });
    const { id: sessionId } = session;

    ws.send(JSON.stringify({ type: 'session:created', session }));
    sessionSockets.set(sessionId, ws);

    ws.on('message', (raw: Buffer) => {
      void (async () => {
        let msg: { type: string; payload?: Record<string, unknown>; id?: string; message?: string };
        try {
          msg = JSON.parse(raw.toString()) as typeof msg;
        } catch {
          return;
        }

        if (msg.type === 'annotation:create' && msg.payload) {
          const annotation = await store.createAnnotation({
            ...(msg.payload as Parameters<typeof store.createAnnotation>[0]),
            sessionId,
          });
          ws.send(JSON.stringify({ type: 'annotation:created', annotation }));
        } else if (msg.type === 'annotation:reply' && msg.id && msg.message) {
          const updated = await store.addReply(msg.id, { author: 'user', message: msg.message });
          if (updated) ws.send(JSON.stringify({ type: 'annotation:updated', annotation: updated }));
        } else if (msg.id) {
          const updated = await store.updateAnnotation(msg.id, { status: 'dismissed' });
          if (updated) ws.send(JSON.stringify({ type: 'annotation:updated', annotation: updated }));
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
      if (ws.readyState !== 1 /* OPEN */) continue;
      const annotations = await store.listAnnotations(sessionId);
      ws.send(JSON.stringify({ type: 'annotations:sync', annotations }));
    }
  })();
}, SYNC_MS);

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer((_req, res) => {
  res.writeHead(404);
  res.end();
});

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/__annotate') return;
  wss.handleUpgrade(req, socket, head, (ws) => { wss.emit('connection', ws, req); });
});

writeManifest();

server.listen(PORT, () => {
  console.log(`[ng-annotate] WebSocket server listening on port ${PORT.toString()}`);
});
