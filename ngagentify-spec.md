# ng-annotate-mcp — Technical Specification v2

## Overview

A development-only Angular toolchain addon that exposes a running Angular application as a rich context provider to an AI agent via MCP. The developer can visually select components and annotate them with change requests. An AI agent (e.g. Claude Code) connects to the MCP server, watches for pending annotations, and applies fixes to the codebase — with full context about the component’s identity, source location, current state, and the developer’s intent.

-----

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (dev mode only)                                        │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │  Angular Application │◄──►│  NgAnnotateModule             │  │
│  │  (user's app)        │    │  - OverlayComponent           │  │
│  └──────────────────────┘    │  - InspectorService           │  │
│                              │  - BridgeService (WebSocket)  │  │
│                              └───────────┬──────────────────┘  │
└──────────────────────────────────────────┼──────────────────────┘
                                           │ WebSocket
                                           │ ws://localhost:4200/__annotate
┌──────────────────────────────────────────┼──────────────────────┐
│  Vite Dev Server                         │                       │
│                                          │                       │
│  ┌───────────────────────────────────────▼──────────────────┐  │
│  │  vite-plugin-ng-annotate                                  │  │
│  │  - Attaches WS handler to dev server                      │  │
│  │  - Reads/writes file-based annotation store               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  MCP Server (standalone Node process, started by agent)         │
│  - Reads/writes same file-based annotation store                │
│  - Exposes tools to AI agent                                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ stdio
┌───────────────────────────────▼─────────────────────────────────┐
│  AI Agent (Claude Code)                                          │
│  - Calls watch_annotations (long-poll)                           │
│  - Acknowledges, fixes, resolves or dismisses                    │
│  - Replies to thread for clarification                           │
└──────────────────────────────────────────────────────────────────┘
```

### Store coordination

The Vite plugin and the MCP server run in separate Node processes. They share state via a JSON file (`.ng-annotate/store.json`) in the project root, using file locking for safe concurrent access. This approach:

- Survives Vite restarts without losing annotations
- Lets the agent connect independently without coupling to the Vite process
- Requires no IPC setup

The store file is gitignored. The locking library is `proper-lockfile`.

-----

## Data Model

### Session

A session represents a browser tab connection to the dev server. A new session is created when the Angular app connects via WebSocket, and marked inactive when it disconnects. Sessions allow the agent to scope its work or operate across all sessions at once.

```ts
interface Session {
  id: string;                    // UUID
  createdAt: string;             // ISO 8601
  lastSeenAt: string;            // updated on each WS message
  active: boolean;               // false when WS disconnects
  url: string;                   // browser URL at time of connection
}
```

### Annotation

```ts
type AnnotationStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

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
  status: AnnotationStatus;
  replies: AnnotationReply[];

  // Component context (captured at annotation time)
  componentName: string;
  componentFilePath: string;      // project-root-relative
  templateFilePath?: string;      // project-root-relative, if external template
  selector: string;
  inputs: Record<string, unknown>;
  domSnapshot: string;            // outerHTML, capped at 5KB
  componentTreePath: string[];    // ancestor component names, root → immediate parent

  // User intent
  annotationText: string;
  selectionText?: string;         // text the user highlighted within the component
}
```

### Store file shape

```json
{
  "sessions": { "<id>": { ...Session } },
  "annotations": { "<id>": { ...Annotation } }
}
```

-----

## Package Structure

```
ng-annotate-mcp/
├── packages/
│   ├── vite-plugin/
│   │   ├── src/
│   │   │   ├── index.ts          # Vite plugin entry
│   │   │   ├── ws-handler.ts     # WebSocket bridge
│   │   │   ├── store.ts          # File-based store (shared)
│   │   │   └── manifest.ts       # Build-time component manifest
│   │   └── package.json
│   │
│   ├── mcp-server/
│   │   ├── src/
│   │   │   ├── index.ts          # MCP server entry (bin)
│   │   │   ├── tools.ts          # All MCP tool definitions
│   │   │   └── store.ts          # Re-exports shared store
│   │   └── package.json
│   │
│   └── angular/
│       ├── src/
│       │   ├── annotate.module.ts
│       │   ├── overlay/
│       │   │   ├── overlay.component.ts
│       │   │   └── overlay.component.scss
│       │   ├── inspector.service.ts
│       │   └── bridge.service.ts
│       └── package.json
│
├── demo/                         # Companion Angular app (see Phase 0)
│   ├── src/
│   └── package.json
│
└── package.json                  # npm workspace root
```

Install in an external project:

```bash
npm install -D ng-annotate-mcp @ng-annotate/angular
```

-----

## Phase 0 — Companion Demo App

The demo app serves two purposes: it is the primary test harness during development, and it doubles as living documentation of how the tool is integrated. It lives in the monorepo and always runs against the local source of the packages — never a published version.

### 0.1 Repo structure and workspace setup

The root `package.json` declares an npm workspace that includes all packages and the demo app:

```json
{
  "name": "ng-annotate-mcp",
  "private": true,
  "workspaces": [
    "packages/vite-plugin",
    "packages/mcp-server",
    "packages/angular",
    "demo"
  ],
  "scripts": {
    "build:packages": "npm run build --workspaces --if-present",
    "dev": "npm run build:packages && npm run dev --workspace=demo",
    "dev:watch": "concurrently \"npm run build:watch --workspace=packages/vite-plugin\" \"npm run build:watch --workspace=packages/mcp-server\" \"npm run build:watch --workspace=packages/angular\" \"npm run dev --workspace=demo\""
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

`npm run dev:watch` is the primary development command — it watches all three packages for source changes and rebuilds them, while simultaneously running the demo app’s dev server. When you edit a package, it rebuilds and Vite picks up the change automatically.

### 0.2 Demo app package.json

The demo depends on the local packages by workspace name. npm workspaces resolves these to the local source rather than the registry:

```json
{
  "name": "ng-annotate-demo",
  "private": true,
  "dependencies": {
    "@angular/core": "^21.0.0",
    "@ng-annotate/angular": "*"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^21.0.0",
    "ng-annotate-mcp": "*",
    "typescript": "~5.6.0"
  },
  "scripts": {
    "dev": "ng serve",
    "build": "ng build"
  }
}
```

The `"*"` version specifier means “whatever version exists in the workspace” — npm resolves this to a symlink into `packages/vite-plugin` and `packages/angular` respectively. No `npm link` or path aliases needed.

### 0.3 TypeScript path resolution for package source

Because the packages are symlinked rather than built to `node_modules` as compiled output, the demo’s `tsconfig.json` needs to point at the TypeScript source directly during development. This avoids having to compile the packages before every change:

```json
{
  "compilerOptions": {
    "paths": {
      "@ng-annotate/angular": ["../packages/angular/src/index.ts"],
      "ng-annotate-mcp/vite-plugin": ["../packages/vite-plugin/src/index.ts"]
    }
  }
}
```

Vite resolves these paths at dev-server startup. When the package source changes, Vite’s module graph invalidates the affected modules and HMR applies the update — including changes to the plugin itself where possible. Changes to `configureServer` (the WS handler, store logic) require a dev server restart, which is a one-keystroke operation.

### 0.4 Demo app content

The demo app should provide a variety of component shapes that exercise the full range of what the inspector service needs to handle. It is not a realistic product UI — it is a deliberate test surface. Include:

**Simple components** — a stateless presentational component with no inputs, to verify baseline inspection works.

**Components with inputs** — several components that accept `@Input()` properties of different types (string, number, object, array), to verify input extraction and display in the annotation panel.

**Nested component trees** — components rendered inside other components at least 3–4 levels deep, to verify `componentTreePath` is built correctly and the ancestor chain is readable.

**Components with external templates** — at least one component using `templateUrl` rather than inline template, to verify the manifest captures both file paths and the agent receives the correct `templateFilePath`.

**A component with a named selector** — e.g. `[appHighlight]` attribute selector rather than an element selector, to verify selector extraction handles non-element forms.

**A list-rendering component** — a component that renders a list of items via `*ngFor`, to verify that clicking on a list item correctly resolves to the right component rather than a parent.

**A deliberately broken component** — a component with a visible bug (wrong text, wrong colour, layout issue) that can be annotated and fixed as a realistic end-to-end test scenario. Reset it after each test run, or keep a `git stash` handy.

### 0.5 Demo app Angular integration

The demo app’s `app.module.ts` shows exactly how a real consumer would integrate the tool:

```ts
import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NgAnnotateModule } from '@ng-annotate/angular';
import { AppComponent } from './app.component';
// ... other demo components

@NgModule({
  declarations: [
    AppComponent,
    // all demo components
  ],
  imports: [
    BrowserModule,
    isDevMode() ? NgAnnotateModule : []
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

The demo’s `angular.json` shows how a real consumer would add the Vite plugin:

```json
{
  "projects": {
    "ng-annotate-demo": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "plugins": ["ng-annotate-mcp/vite-plugin"]
          }
        }
      }
    }
  }
}
```

### 0.6 MCP config for the demo

The demo app’s `.mcp.json` points at the local MCP server source, so the agent always runs the dev version:

```json
{
  "mcpServers": {
    "ng-annotate": {
      "command": "npx",
      "args": ["tsx", "../packages/mcp-server/src/index.ts"]
    }
  }
}
```

Using `tsx` to run the TypeScript source directly means the agent picks up MCP server changes without a compile step. Add `tsx` to the root devDependencies.

### 0.7 Angular CLI usage policy

The Angular CLI (`ng`) is the authoritative tool for all Angular-specific operations. Never bypass it in favour of raw `tsc`, `vite`, or manual file operations where a `ng` equivalent exists.

|Operation                |Command                                                              |
|-------------------------|---------------------------------------------------------------------|
|Scaffold demo app        |`ng new ng-annotate-demo --routing=false --style=scss`               |
|Generate a demo component|`ng generate component components/my-demo --project=ng-annotate-demo`|
|Generate a demo service  |`ng generate service services/my-service --project=ng-annotate-demo` |
|Run demo dev server      |via `scripts/dev.sh` (see 0.8) — never `ng serve` directly           |
|Build demo               |`ng build --project=ng-annotate-demo`                                |
|Run Angular tests        |`ng test --project=ng-annotate-demo`                                 |

All `ng generate` commands are run from the repo root. The `--project` flag ensures the CLI targets the demo app inside the monorepo rather than inferring a default.

When adding a new demo component to exercise a specific inspector edge case, always generate it with `ng generate` rather than creating files manually. This keeps Angular module registrations, file naming, and directory structure consistent.

### 0.8 Helper scripts

All scripts live in `scripts/` at the repo root. They are executable shell scripts, kept simple and well-commented. Add `"scripts"` entries in the root `package.json` that delegate to them so contributors can use `npm run <name>` without knowing the script paths.

```
scripts/
├── dev.sh          # Start demo dev server (stops any existing instance first)
├── build.sh        # Build all packages in dependency order
├── build-watch.sh  # Build all packages in watch mode + start demo server
├── demo-reset.sh   # Reset the demo app's broken component to its original state
└── clean.sh        # Remove all build artifacts and .ng-annotate store files
```

Root `package.json` script entries:

```json
{
  "scripts": {
    "dev": "bash scripts/dev.sh",
    "build": "bash scripts/build.sh",
    "dev:watch": "bash scripts/build-watch.sh",
    "demo:reset": "bash scripts/demo-reset.sh",
    "clean": "bash scripts/clean.sh"
  }
}
```

-----

#### `scripts/dev.sh` — deterministic demo server start

This is the most important script. It guarantees a clean server start every time by finding and terminating any existing process bound to the dev server port before starting a new one. Running it twice in a row, or after a crash, always produces exactly one running dev server.

```bash
#!/usr/bin/env bash
set -euo pipefail

PORT=4200
PIDFILE=".ng-annotate/dev-server.pid"

echo "▶ ng-annotate dev server"

# --- Stop any existing instance ---

# Method 1: check our own pidfile
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "  Stopping previous dev server (pid $OLD_PID)..."
    kill "$OLD_PID"
    # Wait up to 5s for it to exit
    for i in $(seq 1 10); do
      sleep 0.5
      kill -0 "$OLD_PID" 2>/dev/null || break
    done
    # Force-kill if still alive
    kill -0 "$OLD_PID" 2>/dev/null && kill -9 "$OLD_PID" || true
  fi
  rm -f "$PIDFILE"
fi

# Method 2: kill anything else bound to the port (covers crash/external starts)
if lsof -ti tcp:"$PORT" > /dev/null 2>&1; then
  echo "  Port $PORT is in use — terminating occupying process..."
  lsof -ti tcp:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

# --- Ensure packages are built before starting ---
echo "  Building packages..."
bash scripts/build.sh

# --- Start the dev server ---
mkdir -p .ng-annotate

echo "  Starting Angular dev server on port $PORT..."
cd demo && ng serve --port "$PORT" &
DEV_PID=$!

# Write pidfile so future invocations can stop it cleanly
echo "$DEV_PID" > "../$PIDFILE"

echo "  Dev server started (pid $DEV_PID)"
echo "  http://localhost:$PORT"
echo ""
echo "  Run 'npm run dev' again to restart cleanly."
echo "  Ctrl+C to stop."

# Keep script alive so Ctrl+C propagates to ng serve
wait "$DEV_PID"
```

-----

#### `scripts/build.sh` — build all packages in dependency order

Packages must be built in order: `vite-plugin` first (the store module is imported by `mcp-server`), then `mcp-server`, then `angular`.

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "▶ Building packages..."

echo "  [1/3] vite-plugin"
npm run build --workspace=packages/vite-plugin

echo "  [2/3] mcp-server"
npm run build --workspace=packages/mcp-server

echo "  [3/3] angular"
npm run build --workspace=packages/angular

echo "✓ All packages built"
```

-----

#### `scripts/build-watch.sh` — watch mode + dev server

Builds all packages once first (to ensure clean state), then runs all watch processes and the dev server concurrently. Uses `concurrently` with labelled output so log lines are attributable.

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "▶ Building packages (initial)..."
bash scripts/build.sh

echo "▶ Starting watch mode + dev server..."

# Stop any existing dev server before handing off to concurrently
PORT=4200
if lsof -ti tcp:"$PORT" > /dev/null 2>&1; then
  echo "  Stopping existing server on port $PORT..."
  lsof -ti tcp:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

npx concurrently \
  --names "vite-plugin,mcp-server,angular,demo" \
  --prefix-colors "cyan,yellow,magenta,green" \
  "npm run build:watch --workspace=packages/vite-plugin" \
  "npm run build:watch --workspace=packages/mcp-server" \
  "npm run build:watch --workspace=packages/angular" \
  "cd demo && ng serve --port 4200"
```

-----

#### `scripts/demo-reset.sh` — reset broken demo component

Resets the deliberately broken demo component to its original broken state so the end-to-end annotation loop can be re-run repeatably. Uses `git checkout` against the specific file, so the reset is always deterministic regardless of what the agent changed.

```bash
#!/usr/bin/env bash
set -euo pipefail

BROKEN_COMPONENT="demo/src/app/components/broken-card"

echo "▶ Resetting broken demo component..."

git checkout HEAD -- "$BROKEN_COMPONENT"

echo "✓ Reset — $BROKEN_COMPONENT restored to original state"
echo "  HMR will pick up the change automatically if the dev server is running."
```

-----

#### `scripts/clean.sh` — remove all build artifacts

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "▶ Cleaning..."

rm -rf packages/vite-plugin/dist
rm -rf packages/mcp-server/dist
rm -rf packages/angular/dist
rm -rf demo/dist
rm -rf .ng-annotate
rm -rf demo/.ng-annotate

echo "✓ Clean complete"
```

### 0.9 .gitignore additions

```
# Build artifacts
packages/*/dist/
demo/dist/

# ng-annotate runtime files
.ng-annotate/
demo/.ng-annotate/
```

### 0.10 Validating the setup

After `npm install` and `npm run dev:watch`, the following should all be true before moving to Phase 1:

- The demo app loads at `localhost:4200`
- `window.__NG_ANNOTATE_MANIFEST__` is defined in the browser console and contains entries for every demo component
- `ng.getComponent(document.querySelector('app-root'))` returns the root component instance
- `.ng-annotate/store.json` is created in the demo directory when the browser connects
- Claude Code can connect to the MCP server and `get_all_pending` returns an empty array

-----

## Phase 1 — File-Based Store

This module is imported by both the Vite plugin and the MCP server. It is the single source of truth.

File: `packages/vite-plugin/src/store.ts`

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as lockfile from 'proper-lockfile';

const STORE_DIR = '.ng-annotate';
const STORE_PATH = path.join(process.cwd(), STORE_DIR, 'store.json');

type AnnotationStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

export interface Session {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  active: boolean;
  url: string;
}

export interface AnnotationReply {
  id: string;
  createdAt: string;
  author: 'agent' | 'user';
  message: string;
}

export interface Annotation {
  id: string;
  sessionId: string;
  createdAt: string;
  status: AnnotationStatus;
  replies: AnnotationReply[];
  componentName: string;
  componentFilePath: string;
  templateFilePath?: string;
  selector: string;
  inputs: Record<string, unknown>;
  domSnapshot: string;
  componentTreePath: string[];
  annotationText: string;
  selectionText?: string;
}

interface StoreData {
  sessions: Record<string, Session>;
  annotations: Record<string, Annotation>;
}

// --- Watchers (in-process subscribers for watch_annotations) ---
// Each watcher is a function that gets called when a new pending annotation arrives.
// These are in-memory only — each process maintains its own watcher list.
const watchers = new Set<(annotation: Annotation) => void>();

export function notifyWatchers(annotation: Annotation) {
  watchers.forEach(fn => fn(annotation));
}

export function addWatcher(fn: (a: Annotation) => void): () => void {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

// --- Store I/O ---

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ sessions: {}, annotations: {} }, null, 2));
  }
}

async function readStore(): Promise<StoreData> {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
}

async function writeStore(data: StoreData): Promise<void> {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

async function withLock<T>(fn: (data: StoreData) => T): Promise<T> {
  ensureStore();
  const release = await lockfile.lock(STORE_PATH, { retries: { retries: 5, minTimeout: 50 } });
  try {
    const data = await readStore();
    const result = fn(data);
    await writeStore(data);
    return result;
  } finally {
    await release();
  }
}

// --- Public API ---

export const store = {
  // Sessions
  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'lastSeenAt'>): Promise<Session> {
    return withLock(data => {
      const s: Session = {
        ...session,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      };
      data.sessions[s.id] = s;
      return s;
    });
  },

  async updateSession(id: string, patch: Partial<Session>): Promise<void> {
    return withLock(data => {
      if (data.sessions[id]) {
        data.sessions[id] = { ...data.sessions[id], ...patch };
      }
    });
  },

  async listSessions(): Promise<Session[]> {
    const data = await readStore();
    return Object.values(data.sessions);
  },

  async getSession(id: string): Promise<Session | undefined> {
    const data = await readStore();
    return data.sessions[id];
  },

  // Annotations
  async createAnnotation(payload: Omit<Annotation, 'id' | 'createdAt' | 'status' | 'replies'>): Promise<Annotation> {
    return withLock(data => {
      const a: Annotation = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        replies: []
      };
      data.annotations[a.id] = a;
      // Notify in-process watchers (MCP server side)
      setImmediate(() => notifyWatchers(a));
      return a;
    });
  },

  async getAnnotation(id: string): Promise<Annotation | undefined> {
    const data = await readStore();
    return data.annotations[id];
  },

  async listAnnotations(sessionId?: string, status?: AnnotationStatus): Promise<Annotation[]> {
    const data = await readStore();
    return Object.values(data.annotations).filter(a =>
      (!sessionId || a.sessionId === sessionId) &&
      (!status || a.status === status)
    ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async updateAnnotation(id: string, patch: Partial<Annotation>): Promise<Annotation | undefined> {
    return withLock(data => {
      if (!data.annotations[id]) return undefined;
      data.annotations[id] = { ...data.annotations[id], ...patch };
      return data.annotations[id];
    });
  },

  async addReply(annotationId: string, reply: Omit<AnnotationReply, 'id' | 'createdAt'>): Promise<Annotation | undefined> {
    return withLock(data => {
      const a = data.annotations[annotationId];
      if (!a) return undefined;
      a.replies.push({
        ...reply,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      });
      return a;
    });
  }
};
```

> **Note on cross-process watching:** The `notifyWatchers` call only fires within the process that writes the annotation — i.e. the Vite plugin process when the browser submits one. The MCP server is a separate process and won’t receive this in-process notification. For the MCP server’s `watch_annotations` implementation, the store is polled on a short interval (500ms) during the hold period rather than relying on the subscriber. This is an acceptable tradeoff given the file-based architecture — 500ms poll during a 25s hold window is negligible I/O.

-----

## Phase 2 — Vite Plugin

### 2.1 Plugin Entry

File: `packages/vite-plugin/src/index.ts`

```ts
import type { Plugin, ViteDevServer } from 'vite';
import { createWsHandler } from './ws-handler';
import { createManifestPlugin } from './manifest';

export function ngAnnotateMcp(): Plugin[] {
  return [
    {
      name: 'ng-annotate-mcp:ws',
      configureServer(server: ViteDevServer) {
        createWsHandler(server);

        const originalPrintUrls = server.printUrls.bind(server);
        server.printUrls = () => {
          originalPrintUrls();
          console.log('  \x1b[35m➜\x1b[0m  ng-annotate: active (Alt+Shift+A in browser)');
        };
      }
    },
    createManifestPlugin()
  ];
}
```

### 2.2 WebSocket Handler

File: `packages/vite-plugin/src/ws-handler.ts`

Manages browser connections. Each connection creates a session. Incoming messages create annotations. Outgoing messages push status updates back to the overlay.

```ts
import { WebSocketServer, WebSocket } from 'ws';
import type { ViteDevServer } from 'vite';
import { store } from './store';

export function createWsHandler(server: ViteDevServer) {
  const wss = new WebSocketServer({ noServer: true });

  // Map sessionId → WebSocket for pushing updates back to browser
  const sessionSockets = new Map<string, WebSocket>();

  server.httpServer!.on('upgrade', (req, socket, head) => {
    if (req.url === '/__annotate') {
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    }
  });

  wss.on('connection', async (ws: WebSocket, req: any) => {
    const url = req.headers['referer'] ?? 'unknown';
    const session = await store.createSession({ active: true, url });
    sessionSockets.set(session.id, ws);

    console.log(`[ng-annotate] Browser connected — session ${session.id}`);

    // Send session ID back to browser immediately
    ws.send(JSON.stringify({ type: 'session:created', session }));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'session:ping') {
          await store.updateSession(session.id, { lastSeenAt: new Date().toISOString() });
        }

        if (msg.type === 'annotation:create') {
          const annotation = await store.createAnnotation({
            ...msg.payload,
            sessionId: session.id
          });
          ws.send(JSON.stringify({ type: 'annotation:created', annotation }));
        }

        if (msg.type === 'annotation:delete') {
          // Only allow deleting own session's pending annotations
          const a = await store.getAnnotation(msg.id);
          if (a?.sessionId === session.id && a.status === 'pending') {
            await store.updateAnnotation(msg.id, { status: 'dismissed' });
          }
        }

        if (msg.type === 'annotation:reply') {
          // User reply from the overlay thread view
          const annotation = await store.addReply(msg.id, {
            author: 'user',
            message: msg.message
          });
          if (annotation) {
            ws.send(JSON.stringify({ type: 'annotation:updated', annotation }));
          }
        }

      } catch (e) {
        console.error('[ng-annotate] WS parse error', e);
      }
    });

    ws.on('close', async () => {
      console.log(`[ng-annotate] Browser disconnected — session ${session.id}`);
      sessionSockets.delete(session.id);
      await store.updateSession(session.id, { active: false });
    });
  });

  // Push agent status updates to the relevant browser session
  // Poll store for annotation changes and forward to browser
  // (Simple approach: browser can also poll via WS ping/pong)
  // More elegant: the MCP server writes to store, Vite plugin polls and forwards
  setInterval(async () => {
    for (const [sessionId, ws] of sessionSockets.entries()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const annotations = await store.listAnnotations(sessionId);
      ws.send(JSON.stringify({ type: 'annotations:sync', annotations }));
    }
  }, 2000); // Push full sync every 2s — simple and reliable
}
```

### 2.3 Component Manifest

File: `packages/vite-plugin/src/manifest.ts`

Intercepts Angular component files during Vite’s transform phase to build a class-name → file-path map, then injects it into the browser as a virtual module.

```ts
import type { Plugin } from 'vite';
import * as path from 'path';

interface ManifestEntry {
  component: string;   // project-root-relative path to .ts file
  template?: string;   // project-root-relative path to .html file, if external
}

export function createManifestPlugin(): Plugin {
  let projectRoot = '';
  const manifest: Record<string, ManifestEntry> = {};

  return {
    name: 'ng-annotate-mcp:manifest',

    configResolved(config) {
      projectRoot = config.root;
    },

    transform(code: string, id: string) {
      if (!id.endsWith('.ts') || !code.includes('@Component')) return;

      const classMatch = code.match(/export\s+(?:default\s+)?class\s+(\w+)/);
      if (!classMatch) return;

      const className = classMatch[1];
      const relativePath = path.relative(projectRoot, id).replace(/\\/g, '/');

      const templateUrlMatch = code.match(/templateUrl\s*:\s*['"](.+?)['"]/);
      const templateRelative = templateUrlMatch
        ? path.relative(
            projectRoot,
            path.resolve(path.dirname(id), templateUrlMatch[1])
          ).replace(/\\/g, '/')
        : undefined;

      manifest[className] = {
        component: relativePath,
        template: templateRelative
      };
    },

    resolveId(id: string) {
      if (id === 'virtual:ng-annotate-manifest') return '\0ng-annotate-manifest';
    },

    load(id: string) {
      if (id === '\0ng-annotate-manifest') {
        return `
          if (typeof window !== 'undefined') {
            window.__NG_ANNOTATE_MANIFEST__ = ${JSON.stringify(manifest)};
          }
          export default {};
        `;
      }
    }
  };
}
```

Usage in `angular.json`:

```json
{
  "projects": {
    "your-app": {
      "architect": {
        "build": {
          "options": {
            "plugins": ["ng-annotate-mcp/vite-plugin"]
          }
        }
      }
    }
  }
}
```

-----

## Phase 3 — MCP Server

### 3.1 Tool Surface

|Tool               |Description                                          |
|-------------------|-----------------------------------------------------|
|`list_sessions`    |All sessions (active and inactive)                   |
|`get_session`      |One session with all its annotations                 |
|`get_pending`      |Pending annotations for a specific session           |
|`get_all_pending`  |Pending annotations across all sessions, oldest first|
|`acknowledge`      |Claim an annotation before starting work             |
|`resolve`          |Mark as fixed, with optional summary                 |
|`dismiss`          |Won’t fix, with required reason                      |
|`reply`            |Add a message to the annotation thread               |
|`watch_annotations`|Block until new annotations appear (long-poll)       |

### 3.2 Implementation

File: `packages/mcp-server/src/tools.ts`

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { store, addWatcher } from '../../vite-plugin/src/store';

const DEFAULT_WATCH_TIMEOUT_MS = 25_000;
const WATCH_POLL_INTERVAL_MS = 500;

export function registerTools(server: McpServer) {

  // --- Session tools ---

  server.tool(
    'list_sessions',
    'List all annotation sessions. Each session corresponds to a browser tab running the Angular app.',
    {},
    async () => {
      const sessions = await store.listSessions();
      return json(sessions);
    }
  );

  server.tool(
    'get_session',
    'Get a session and all its annotations.',
    { sessionId: z.string() },
    async ({ sessionId }) => {
      const session = await store.getSession(sessionId);
      if (!session) return error(`Session ${sessionId} not found`);
      const annotations = await store.listAnnotations(sessionId);
      return json({ session, annotations });
    }
  );

  // --- Query tools ---

  server.tool(
    'get_pending',
    'Get pending annotations for a specific session, oldest first.',
    { sessionId: z.string() },
    async ({ sessionId }) => {
      const annotations = await store.listAnnotations(sessionId, 'pending');
      return json(annotations);
    }
  );

  server.tool(
    'get_all_pending',
    'Get all pending annotations across all sessions, oldest first. Use this to start the work loop.',
    {},
    async () => {
      const annotations = await store.listAnnotations(undefined, 'pending');
      return json(annotations);
    }
  );

  // --- Action tools ---

  server.tool(
    'acknowledge',
    'Claim an annotation before starting work. Always call this before making changes to prevent duplicate effort.',
    {
      id: z.string(),
      message: z.string().optional().describe('Optional message shown in the browser overlay, e.g. "Looking at this now"')
    },
    async ({ id, message }) => {
      const a = await store.getAnnotation(id);
      if (!a) return error(`Annotation ${id} not found`);
      if (a.status !== 'pending') return error(`Annotation ${id} is ${a.status}, not pending`);

      const updated = await store.updateAnnotation(id, { status: 'acknowledged' });
      if (message && updated) {
        await store.addReply(id, { author: 'agent', message });
      }
      return json({ ok: true, annotation: updated });
    }
  );

  server.tool(
    'resolve',
    'Mark an annotation as resolved after successfully applying the requested change.',
    {
      id: z.string(),
      summary: z.string().optional().describe('Summary of what was changed, shown in the browser overlay')
    },
    async ({ id, summary }) => {
      const a = await store.getAnnotation(id);
      if (!a) return error(`Annotation ${id} not found`);

      const updated = await store.updateAnnotation(id, { status: 'resolved' });
      if (summary && updated) {
        await store.addReply(id, { author: 'agent', message: summary });
      }
      return json({ ok: true, annotation: updated });
    }
  );

  server.tool(
    'dismiss',
    'Dismiss an annotation you cannot or should not resolve. Always provide a clear reason.',
    {
      id: z.string(),
      reason: z.string().describe('Why this annotation is being dismissed')
    },
    async ({ id, reason }) => {
      const a = await store.getAnnotation(id);
      if (!a) return error(`Annotation ${id} not found`);

      const updated = await store.updateAnnotation(id, { status: 'dismissed' });
      await store.addReply(id, { author: 'agent', message: `Dismissed: ${reason}` });
      return json({ ok: true, annotation: updated });
    }
  );

  server.tool(
    'reply',
    'Add a message to an annotation thread. Use this to ask a clarifying question or post a progress update.',
    {
      id: z.string(),
      message: z.string()
    },
    async ({ id, message }) => {
      const annotation = await store.addReply(id, { author: 'agent', message });
      if (!annotation) return error(`Annotation ${id} not found`);
      return json({ ok: true, annotation });
    }
  );

  // --- Watch tool ---

  server.tool(
    'watch_annotations',
    `Block until new pending annotations appear, then return them immediately.
     If no annotations arrive within the timeout, returns a retry instruction.
     The agent should call this in a loop to efficiently wait for work.
     
     Typical agent loop:
     1. Call get_all_pending to drain any existing queue first
     2. Call watch_annotations in a loop
     3. On receiving annotations, acknowledge and process them
     4. Call watch_annotations again`,
    {
      sessionId: z.string().optional().describe('Scope to a specific session. Omit to watch all sessions.'),
      timeoutMs: z.number().optional().describe('How long to wait before returning a retry response. Default 25000.')
    },
    async ({ sessionId, timeoutMs = DEFAULT_WATCH_TIMEOUT_MS }) => {
      return new Promise((resolve) => {
        let settled = false;

        const settle = (result: any) => {
          if (settled) return;
          settled = true;
          clearInterval(pollInterval);
          clearTimeout(timeoutHandle);
          resolve(result);
        };

        // Seen annotation IDs at the start of this watch window
        // so we only return truly new ones
        let knownIds: Set<string>;

        // Initialise known IDs
        store.listAnnotations(sessionId, 'pending').then(existing => {
          knownIds = new Set(existing.map(a => a.id));
        });

        // Poll for new pending annotations
        const pollInterval = setInterval(async () => {
          if (!knownIds) return; // still initialising
          const current = await store.listAnnotations(sessionId, 'pending');
          const newAnnotations = current.filter(a => !knownIds.has(a.id));

          if (newAnnotations.length > 0) {
            settle(json({
              status: 'annotations',
              count: newAnnotations.length,
              annotations: newAnnotations
            }));
          }
        }, WATCH_POLL_INTERVAL_MS);

        // Timeout — tell the agent to try again
        const timeoutHandle = setTimeout(() => {
          settle(json({
            status: 'timeout',
            annotations: [],
            message: 'No new annotations arrived. Call watch_annotations again to continue waiting.',
            retryAfterMs: 0  // agent can retry immediately — the tool itself handles the wait
          }));
        }, timeoutMs);
      });
    }
  );
}

// Helpers
function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true };
}
```

### 3.3 Server Entry Point

File: `packages/mcp-server/src/index.ts`

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools';

async function main() {
  const server = new McpServer({
    name: 'ng-annotate',
    version: '0.1.0',
    description: 'Connects an AI agent to a live Angular dev session for annotation-driven code changes'
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### 3.4 MCP Configuration

In the project’s `.mcp.json` (picked up automatically by Claude Code):

```json
{
  "mcpServers": {
    "ng-annotate": {
      "command": "node",
      "args": ["./node_modules/ng-annotate-mcp/bin/mcp-server.js"]
    }
  }
}
```

-----

## Phase 4 — Angular Module

### 4.1 Module

File: `packages/angular/src/annotate.module.ts`

```ts
import { NgModule, isDevMode, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OverlayComponent } from './overlay/overlay.component';
import { InspectorService } from './inspector.service';
import { BridgeService } from './bridge.service';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [OverlayComponent],
  providers: isDevMode() ? [
    InspectorService,
    BridgeService,
    {
      provide: APP_INITIALIZER,
      useFactory: (bridge: BridgeService) => () => bridge.init(),
      deps: [BridgeService],
      multi: true
    }
  ] : []
})
export class NgAnnotateModule {}
```

Consumer usage:

```ts
// app.module.ts
import { isDevMode } from '@angular/core';
import { NgAnnotateModule } from '@ng-annotate/angular';

@NgModule({
  imports: [
    isDevMode() ? NgAnnotateModule : []
  ]
})
export class AppModule {}
```

### 4.2 Inspector Service

File: `packages/angular/src/inspector.service.ts`

Resolves a DOM element to full component context using `ng.*` dev APIs and the build-time manifest.

```ts
import { Injectable } from '@angular/core';

declare const ng: any;

export interface ComponentContext {
  componentName: string;
  selector: string;
  componentFilePath: string;
  templateFilePath?: string;
  inputs: Record<string, unknown>;
  domSnapshot: string;
  componentTreePath: string[];
}

@Injectable()
export class InspectorService {

  getComponentContext(element: Element): ComponentContext | null {
    // Walk up to find nearest component boundary
    let current: Element | null = element;
    let component: any = null;
    let componentElement: Element | null = null;

    while (current && !component) {
      component = ng.getComponent(current);
      if (component) componentElement = current;
      else current = current.parentElement;
    }

    if (!component || !componentElement) return null;

    const name = component.constructor.name;
    const paths = this.resolveFilePaths(name);

    return {
      componentName: name,
      selector: this.getSelector(component),
      componentFilePath: paths.component,
      templateFilePath: paths.template,
      inputs: this.getInputs(component),
      domSnapshot: this.snapshot(componentElement),
      componentTreePath: this.buildTreePath(componentElement)
    };
  }

  private getSelector(component: any): string {
    try {
      return component.constructor['ɵcmp']?.selectors?.[0]?.[0] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getInputs(component: any): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    try {
      const inputsDef = component.constructor['ɵcmp']?.inputs ?? {};
      for (const publicName of Object.keys(inputsDef)) {
        const privateName = inputsDef[publicName];
        if (privateName in component) {
          inputs[publicName] = component[privateName];
        }
      }
    } catch {}
    return inputs;
  }

  private buildTreePath(element: Element): string[] {
    const path: string[] = [];
    let current: Element | null = element.parentElement;

    while (current) {
      const comp = ng.getComponent(current);
      if (comp) path.unshift(comp.constructor.name);
      current = current.parentElement;
    }

    return path;
  }

  private snapshot(element: Element): string {
    const html = element.outerHTML;
    return html.length > 5000 ? html.slice(0, 5000) + '<!-- truncated -->' : html;
  }

  private resolveFilePaths(componentName: string): { component: string; template?: string } {
    const manifest = (window as any).__NG_ANNOTATE_MANIFEST__;
    return manifest?.[componentName] ?? { component: `(unresolved: ${componentName})` };
  }
}
```

### 4.3 Bridge Service

File: `packages/angular/src/bridge.service.ts`

```ts
import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import type { Annotation, Session } from './types';

@Injectable()
export class BridgeService implements OnDestroy {
  private ws!: WebSocket;
  private reconnectTimer: any;
  private pingInterval: any;

  readonly session$ = new BehaviorSubject<Session | null>(null);
  readonly annotations$ = new BehaviorSubject<Annotation[]>([]);
  readonly connected$ = new BehaviorSubject<boolean>(false);

  constructor(private zone: NgZone) {}

  init() {
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(`ws://${location.host}/__annotate`);

    this.ws.onopen = () => {
      this.zone.run(() => this.connected$.next(true));
      this.pingInterval = setInterval(() => this.send({ type: 'session:ping' }), 10_000);
    };

    this.ws.onclose = () => {
      this.zone.run(() => this.connected$.next(false));
      clearInterval(this.pingInterval);
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.zone.run(() => {
        if (msg.type === 'session:created') {
          this.session$.next(msg.session);
        }
        if (msg.type === 'annotations:sync') {
          this.annotations$.next(msg.annotations);
        }
        if (msg.type === 'annotation:created' || msg.type === 'annotation:updated') {
          const current = this.annotations$.value;
          const idx = current.findIndex(a => a.id === msg.annotation.id);
          if (idx >= 0) {
            const updated = [...current];
            updated[idx] = msg.annotation;
            this.annotations$.next(updated);
          } else {
            this.annotations$.next([...current, msg.annotation]);
          }
        }
      });
    };
  }

  createAnnotation(payload: any) {
    this.send({ type: 'annotation:create', payload });
  }

  replyToAnnotation(id: string, message: string) {
    this.send({ type: 'annotation:reply', id, message });
  }

  deleteAnnotation(id: string) {
    this.send({ type: 'annotation:delete', id });
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  ngOnDestroy() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingInterval);
    this.ws?.close();
  }
}
```

### 4.4 Overlay Component

File: `packages/angular/src/overlay/overlay.component.ts`

The overlay has three modes: `inspect` (hover to highlight components), `annotate` (panel open, user typing), and `thread` (viewing an existing annotation’s reply thread).

```ts
import {
  Component, HostListener, OnInit, OnDestroy,
  ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import { InspectorService, ComponentContext } from '../inspector.service';
import { BridgeService } from '../bridge.service';
import type { Annotation } from '../types';

type Mode = 'hidden' | 'inspect' | 'annotate' | 'thread';

interface HighlightRect { top: number; left: number; width: number; height: number; }

interface AnnotationBadge {
  annotation: Annotation;
  rect: HighlightRect;
  icon: string;
  label: string;
}

@Component({
  selector: 'nga-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Keyboard hint -->
    <div class="nga-hint" *ngIf="mode === 'hidden'">
      <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> to inspect
    </div>

    <!-- Hover highlight box -->
    <div class="nga-highlight"
         *ngIf="mode === 'inspect' && hoveredContext"
         [style.top.px]="highlightRect.top + scrollY"
         [style.left.px]="highlightRect.left"
         [style.width.px]="highlightRect.width"
         [style.height.px]="highlightRect.height">
      <span class="nga-component-label">{{ hoveredContext.componentName }}</span>
      <span class="nga-path-label">{{ hoveredContext.componentFilePath }}</span>
    </div>

    <!-- Annotation panel -->
    <div class="nga-panel" *ngIf="mode === 'annotate' && selectedContext">
      <div class="nga-panel-header">
        <div class="nga-panel-title">
          <strong>{{ selectedContext.componentName }}</strong>
          <span class="nga-file-path">{{ selectedContext.componentFilePath }}</span>
        </div>
        <button class="nga-close" (click)="cancel()">✕</button>
      </div>

      <div class="nga-tree-path" *ngIf="selectedContext.componentTreePath.length">
        {{ selectedContext.componentTreePath.join(' › ') }} › <strong>{{ selectedContext.componentName }}</strong>
      </div>

      <div class="nga-inputs-preview" *ngIf="hasInputs(selectedContext)">
        <span *ngFor="let kv of inputEntries(selectedContext)" class="nga-input-chip">
          {{ kv[0] }}: {{ kv[1] | json }}
        </span>
      </div>

      <textarea
        #textArea
        class="nga-textarea"
        placeholder="Describe the change you want... (⌘↵ to send)"
        [(ngModel)]="annotationText"
        (keydown.meta.enter)="submit()"
        (keydown.control.enter)="submit()"
        rows="4">
      </textarea>

      <div class="nga-panel-footer">
        <button class="nga-btn-secondary" (click)="cancel()">Cancel</button>
        <button class="nga-btn-primary"
                (click)="submit()"
                [disabled]="!annotationText.trim()">
          Send to Agent ⌘↵
        </button>
      </div>
    </div>

    <!-- Thread panel (agent replies) -->
    <div class="nga-panel nga-thread-panel" *ngIf="mode === 'thread' && threadAnnotation">
      <div class="nga-panel-header">
        <strong>{{ threadAnnotation.componentName }}</strong>
        <div class="nga-status-badge" [class]="'nga-status--' + threadAnnotation.status">
          {{ threadAnnotation.status }}
        </div>
        <button class="nga-close" (click)="closeThread()">✕</button>
      </div>

      <div class="nga-thread-request">{{ threadAnnotation.annotationText }}</div>

      <div class="nga-thread-replies">
        <div *ngFor="let reply of threadAnnotation.replies"
             class="nga-reply"
             [class.nga-reply--agent]="reply.author === 'agent'"
             [class.nga-reply--user]="reply.author === 'user'">
          <span class="nga-reply-author">{{ reply.author === 'agent' ? '🤖 Agent' : '👤 You' }}</span>
          <span class="nga-reply-text">{{ reply.message }}</span>
        </div>
      </div>

      <div class="nga-thread-input" *ngIf="threadAnnotation.status === 'acknowledged'">
        <textarea [(ngModel)]="replyText"
                  placeholder="Reply to agent..."
                  (keydown.meta.enter)="sendReply()"
                  rows="2"></textarea>
        <button (click)="sendReply()" [disabled]="!replyText.trim()">Reply ⌘↵</button>
      </div>
    </div>

    <!-- Annotation badges on components -->
    <div *ngFor="let badge of badges"
         class="nga-badge"
         [class]="'nga-badge--' + badge.annotation.status"
         [style.top.px]="badge.rect.top + scrollY"
         [style.left.px]="badge.rect.left + badge.rect.width - 28"
         (click)="openThread(badge.annotation)">
      {{ badge.icon }}
    </div>
  `
})
export class OverlayComponent implements OnInit, OnDestroy {
  @ViewChild('textArea') textAreaRef!: ElementRef;

  mode: Mode = 'hidden';
  hoveredContext: ComponentContext | null = null;
  selectedContext: ComponentContext | null = null;
  highlightRect: HighlightRect = { top: 0, left: 0, width: 0, height: 0 };
  annotationText = '';
  replyText = '';
  threadAnnotation: Annotation | null = null;
  badges: AnnotationBadge[] = [];
  scrollY = 0;

  private sub!: Subscription;
  private annotations: Annotation[] = [];

  constructor(
    private inspector: InspectorService,
    private bridge: BridgeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.sub = this.bridge.annotations$.subscribe(annotations => {
      this.annotations = annotations;
      this.updateBadges();
      // Update open thread if it changed
      if (this.threadAnnotation) {
        this.threadAnnotation = annotations.find(a => a.id === this.threadAnnotation!.id) ?? null;
      }
      this.cdr.markForCheck();
    });
  }

  @HostListener('document:keydown.alt.shift.a', ['$event'])
  toggleInspect(e: KeyboardEvent) {
    e.preventDefault();
    if (this.mode === 'hidden') {
      this.mode = 'inspect';
    } else if (this.mode === 'inspect') {
      this.mode = 'hidden';
      this.hoveredContext = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.cancel();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.mode !== 'inspect') return;
    this.scrollY = window.scrollY;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest('nga-overlay')) return;

    const context = this.inspector.getComponentContext(el as Element);
    if (context) {
      this.hoveredContext = context;
      const rect = (el as Element).getBoundingClientRect();
      this.highlightRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  onClick(e: MouseEvent) {
    if (this.mode !== 'inspect') return;
    if ((e.target as Element).closest('nga-overlay')) return;

    e.preventDefault();
    e.stopPropagation();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const context = el ? this.inspector.getComponentContext(el as Element) : null;

    if (context) {
      this.selectedContext = context;
      this.mode = 'annotate';
      setTimeout(() => this.textAreaRef?.nativeElement.focus(), 50);
    }
  }

  @HostListener('window:scroll')
  onScroll() {
    this.scrollY = window.scrollY;
    this.updateBadges();
  }

  submit() {
    if (!this.selectedContext || !this.annotationText.trim()) return;

    this.bridge.createAnnotation({
      ...this.selectedContext,
      annotationText: this.annotationText.trim(),
      selectionText: window.getSelection()?.toString() || undefined
    });

    this.annotationText = '';
    this.mode = 'hidden';
    this.selectedContext = null;
  }

  cancel() {
    if (this.mode === 'annotate') {
      this.mode = 'inspect';
      this.selectedContext = null;
      this.annotationText = '';
    } else {
      this.mode = 'hidden';
      this.hoveredContext = null;
    }
  }

  openThread(annotation: Annotation) {
    this.threadAnnotation = annotation;
    this.mode = 'thread';
  }

  closeThread() {
    this.threadAnnotation = null;
    this.mode = 'hidden';
  }

  sendReply() {
    if (!this.threadAnnotation || !this.replyText.trim()) return;
    this.bridge.replyToAnnotation(this.threadAnnotation.id, this.replyText.trim());
    this.replyText = '';
  }

  hasInputs(context: ComponentContext): boolean {
    return Object.keys(context.inputs).length > 0;
  }

  inputEntries(context: ComponentContext): [string, unknown][] {
    return Object.entries(context.inputs).slice(0, 5); // cap display
  }

  private updateBadges() {
    const statusIcon: Record<string, string> = {
      pending: '⏳',
      acknowledged: '🔄',
      resolved: '✅',
      dismissed: '✗'
    };

    this.badges = this.annotations
      .filter(a => a.status !== 'resolved') // hide resolved after a while
      .map(a => {
        // Find the component's DOM element
        const el = this.findComponentElement(a.componentName, a.selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          annotation: a,
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          icon: statusIcon[a.status] ?? '?',
          label: a.annotationText.slice(0, 50)
        };
      })
      .filter(Boolean) as AnnotationBadge[];
  }

  private findComponentElement(componentName: string, selector: string): Element | null {
    // Try selector first (fast)
    const bySelector = document.querySelector(selector);
    if (bySelector && ng.getComponent(bySelector)?.constructor.name === componentName) {
      return bySelector;
    }
    // Fall back: walk all elements with ng component context
    const all = document.querySelectorAll('*');
    for (const el of Array.from(all)) {
      const comp = ng.getComponent(el);
      if (comp?.constructor.name === componentName) return el;
    }
    return null;
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}

declare const ng: any;
```

-----

## Phase 5 — Agent Prompt

Include this in the project’s `CLAUDE.md`:

```markdown
## ng-annotate-mcp

You have access to the `ng-annotate` MCP server, which is connected to a live Angular
development session running in the browser. The developer annotates components in the
browser with change requests that you should resolve.

### Your work loop

1. Call `get_all_pending` to drain any existing annotations first
2. Process each pending annotation (see below)
3. Call `watch_annotations` — this blocks until new annotations arrive or times out
4. If status is `annotations`, process the returned batch
5. If status is `timeout`, call `watch_annotations` again immediately
6. Repeat from step 3

### Processing an annotation

1. Call `acknowledge` with an optional brief message (shown in browser)
2. Read `componentFilePath` and `templateFilePath` from the annotation
3. Read those files using your file tools
4. Use `annotationText`, `inputs`, `domSnapshot`, and `componentTreePath` as context
5. Make the change. Prefer minimal, targeted edits — do not refactor beyond the request
6. Call `resolve` with a one-sentence summary of what you changed
7. If the request is unclear, call `reply` with a clarifying question instead of guessing
8. If you cannot resolve it, call `dismiss` with a clear reason

### Rules

- Always `acknowledge` before touching any files
- Never modify files without a corresponding annotation
- If you change a template, check whether the component TypeScript also needs updating
- Prefer the annotation's `selectionText` as the primary focus when present
- Do not `resolve` until you have actually written the change to disk
```

-----

## Phase 6 — ESLint Configuration

### 6.1 Philosophy

The lint setup has one job: make incorrect code impossible to commit without a deliberate override. Rules are either on or off — no warnings. Warnings are noise that developers learn to ignore. If a pattern is bad enough to flag, it is bad enough to fail the build.

Every package and the demo app shares a root ESLint config. Packages can extend it with rules specific to their context (Node vs. browser, Angular vs. plain TypeScript).

### 6.2 Installation

From the repo root:

```bash
# Core ESLint and TypeScript support
npm install -D \
  eslint \
  @eslint/js \
  typescript-eslint \
  eslint-plugin-import \
  eslint-plugin-unicorn

# Angular-specific lint rules (run inside demo/)
cd demo && ng add @angular-eslint/schematics
```

`ng add @angular-eslint/schematics` uses the Angular CLI to wire ESLint into the Angular project correctly — it updates `angular.json` to add the lint builder, generates a base `eslint.config.mjs` for the demo app, and installs `@angular-eslint/eslint-plugin` and `@angular-eslint/template-parser`. Never configure Angular ESLint by hand when the schematic can do it.

### 6.3 Root config

File: `eslint.config.mjs` (repo root)

This is the shared base that all packages extend. It uses the flat config format (ESLint 9+).

```js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import unicorn from 'eslint-plugin-unicorn';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    plugins: {
      import: importPlugin,
      unicorn
    },

    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },

    rules: {
      // --- TypeScript ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // --- Imports ---
      'import/no-cycle': 'error',           // catches circular deps between packages
      'import/no-default-export': 'error',  // named exports only — easier to refactor
      'import/order': ['error', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling'],
        'newlines-between': 'always',
        'alphabetize': { order: 'asc' }
      }],

      // --- Code style ---
      'unicorn/prefer-node-protocol': 'error',  // import from 'node:fs' not 'fs'
      'unicorn/no-array-for-each': 'error',
      'unicorn/no-useless-undefined': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',

      // --- Disallow warnings pattern ---
      // All rules are errors. This rule enforces that no rule elsewhere
      // is set to 'warn', keeping the no-warnings philosophy consistent.
      // (enforced by convention and PR review rather than a meta-rule)
    }
  },

  {
    // Test files — relax some rules that are impractical in tests
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off'
    }
  },

  {
    // Ignore built output and generated files
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.js',           // compiled output — lint source only
      'demo/.angular/**'
    ]
  }
);
```

### 6.4 Package-level configs

Each package has a minimal `eslint.config.mjs` that extends the root and sets the correct `tsconfig`:

```js
// packages/vite-plugin/eslint.config.mjs
import rootConfig from '../../eslint.config.mjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...rootConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // Node packages may log to console for dev-server output
      'no-console': 'off'
    }
  }
);
```

```js
// packages/mcp-server/eslint.config.mjs — identical to vite-plugin config above
// packages/angular/eslint.config.mjs — extends root, no overrides needed
```

The demo app’s ESLint config is generated by `ng add @angular-eslint/schematics` and should not be hand-edited beyond adding an `extends` reference to the root config.

### 6.5 Lint scripts

Each package’s `package.json` gets a `lint` script:

```json
{
  "scripts": {
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix"
  }
}
```

The demo app’s lint is run via the Angular CLI builder (already wired by the schematic):

```bash
ng lint --project=ng-annotate-demo
```

Root `package.json` adds workspace-wide lint:

```json
{
  "scripts": {
    "lint": "npm run lint --workspaces --if-present && ng lint --project=ng-annotate-demo",
    "lint:fix": "npm run lint:fix --workspaces --if-present && ng lint --project=ng-annotate-demo --fix"
  }
}
```

Add `bash scripts/lint.sh` as a thin wrapper so lint can be run from anywhere without remembering the workspace flag syntax:

```bash
#!/usr/bin/env bash
# scripts/lint.sh
set -euo pipefail

echo "▶ Linting all packages..."
npm run lint --workspaces --if-present

echo "▶ Linting demo app..."
cd demo && ng lint

echo "✓ Lint passed"
```

### 6.6 Pre-commit enforcement

Install `lint-staged` and `simple-git-hooks` to run lint only on staged files, keeping commits fast:

```bash
npm install -D lint-staged simple-git-hooks
```

Root `package.json`:

```json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "packages/**/*.ts": "eslint --max-warnings=0",
    "demo/src/**/*.ts": "eslint --max-warnings=0",
    "demo/src/**/*.html": "ng lint --project=ng-annotate-demo"
  }
}
```

After installing, activate the hooks once:

```bash
npx simple-git-hooks
```

Add this to `scripts/clean.sh` as a note: cleaning `node_modules` requires re-running `npx simple-git-hooks` to reactivate the hooks.

-----

## Phase 7 — Unit Testing

### 7.1 Philosophy

Tests exist to catch regressions and document behaviour, not to hit a coverage number. Every meaningful unit of logic gets a test. The rule of thumb: if you had to think carefully about how to implement something, you must write a test for it. If it was trivial to write, use your judgment.

The test surface splits cleanly across three environments:

- **Node tests** — store logic, MCP tool behaviour, Vite plugin transforms, WebSocket message handling. Run with Vitest.
- **Angular tests** — `InspectorService`, `BridgeService`, `OverlayComponent`. Run with Karma via the Angular CLI (`ng test`).
- **Integration tests** — a headless browser session against the real demo app that exercises the full annotation loop. Run with Playwright.

### 7.2 Node package tests (Vitest)

Vitest is the natural choice for the Node packages — it shares the Vite config model, has first-class TypeScript support with no extra config, and its API is compatible with Jest so the syntax is familiar.

```bash
npm install -D vitest @vitest/coverage-v8 --workspace=packages/vite-plugin
npm install -D vitest @vitest/coverage-v8 --workspace=packages/mcp-server
```

Each Node package’s `package.json` gets:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

`vitest.config.ts` in each Node package:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,       // explicit imports — no implicit describe/it globals
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/index.ts'] // entry points are thin wrappers, exclude from coverage
    }
  }
});
```

#### What to test in `vite-plugin`

**`store.spec.ts`** — the store is the most critical unit. Test every method in isolation using a temp directory so tests never touch the real project store.

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Point the store at a temp dir before importing
let tempDir: string;
beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-annotate-test-'));
  process.chdir(tempDir);
});
afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// Import after cwd is set so STORE_PATH resolves correctly
const { store } = await import('./store');

describe('store.createAnnotation', () => {
  it('assigns a uuid id and pending status', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost' });
    const annotation = await store.createAnnotation({
      sessionId: session.id,
      componentName: 'TestComponent',
      componentFilePath: 'src/app/test.component.ts',
      selector: 'app-test',
      inputs: {},
      domSnapshot: '<app-test></app-test>',
      componentTreePath: ['AppComponent'],
      annotationText: 'Fix this'
    });

    expect(annotation.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(annotation.status).toBe('pending');
    expect(annotation.replies).toEqual([]);
  });

  it('persists to the store file', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost' });
    await store.createAnnotation({ sessionId: session.id, componentName: 'Foo',
      componentFilePath: 'foo.ts', selector: 'app-foo', inputs: {},
      domSnapshot: '', componentTreePath: [], annotationText: 'test' });

    const raw = JSON.parse(fs.readFileSync('.ng-annotate/store.json', 'utf-8'));
    expect(Object.values(raw.annotations)).toHaveLength(1);
  });
});

describe('store.listAnnotations', () => {
  it('filters by status', async () => {
    // create two pending, acknowledge one
    // assert listAnnotations('pending') returns only the unacknowledged one
  });

  it('filters by sessionId', async () => {
    // create two sessions, create one annotation each
    // assert listAnnotations(session1.id) returns only session1's annotation
  });

  it('returns results sorted oldest first', async () => {
    // create two annotations with known createdAt values
    // assert order
  });
});

describe('store.addReply', () => {
  it('appends reply with correct author and generated id', async () => { /* ... */ });
  it('returns undefined for unknown annotation id', async () => { /* ... */ });
});

describe('store concurrent access', () => {
  it('handles simultaneous writes without data loss', async () => {
    // Fire 10 createAnnotation calls in parallel
    // Assert all 10 appear in the store
    const session = await store.createSession({ active: true, url: 'http://localhost' });
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.createAnnotation({ sessionId: session.id, componentName: `Comp${i}`,
          componentFilePath: `comp${i}.ts`, selector: `app-comp-${i}`, inputs: {},
          domSnapshot: '', componentTreePath: [], annotationText: `task ${i}` })
      )
    );
    expect(results).toHaveLength(10);
    const all = await store.listAnnotations();
    expect(all).toHaveLength(10);
  });
});
```

**`manifest.spec.ts`** — test the Vite transform that extracts component metadata:

```ts
describe('manifest transform', () => {
  it('extracts class name and relative file path from a component file', () => { /* ... */ });
  it('extracts templateUrl and resolves it relative to the component file', () => { /* ... */ });
  it('ignores non-component TypeScript files', () => { /* ... */ });
  it('handles multiple export class statements in one file gracefully', () => { /* ... */ });
});
```

#### What to test in `mcp-server`

**`tools.spec.ts`** — test each MCP tool’s behaviour by calling it directly (not via the MCP protocol), using a real store backed by a temp directory.

```ts
describe('acknowledge tool', () => {
  it('transitions status from pending to acknowledged', async () => { /* ... */ });
  it('returns an error if the annotation does not exist', async () => { /* ... */ });
  it('returns an error if the annotation is already acknowledged', async () => { /* ... */ });
  it('adds a reply when a message is provided', async () => { /* ... */ });
});

describe('resolve tool', () => {
  it('transitions any non-pending status to resolved', async () => { /* ... */ });
  it('adds a reply with the summary text', async () => { /* ... */ });
});

describe('dismiss tool', () => {
  it('transitions to dismissed and records reason in replies', async () => { /* ... */ });
  it('requires a reason — errors if reason is empty string', async () => { /* ... */ });
});

describe('watch_annotations tool', () => {
  it('returns immediately when a pending annotation already exists at call time', async () => {
    // Seed the store with a pending annotation before calling watch
    // Assert it returns status: 'annotations' without waiting for timeout
  });

  it('returns status: timeout after the timeout period with no new annotations', async () => {
    // Call watch with a short timeoutMs (e.g. 200ms)
    // Assert it returns status: 'timeout' and the response contains retryAfterMs
    const start = Date.now();
    const result = await watchTool({ timeoutMs: 200 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(190);
    expect(JSON.parse(result.content[0].text).status).toBe('timeout');
  });

  it('returns early when a new annotation is created during the wait window', async () => {
    // Start watch with a long timeout (5000ms)
    // After 100ms, create a new annotation in the store
    // Assert watch returns well before the timeout with the new annotation
    const watchPromise = watchTool({ timeoutMs: 5000 });
    setTimeout(() => store.createAnnotation({ /* ... */ }), 100);
    const start = Date.now();
    const result = await watchPromise;
    expect(Date.now() - start).toBeLessThan(500);
    expect(JSON.parse(result.content[0].text).status).toBe('annotations');
  });

  it('only returns annotations matching the given sessionId', async () => { /* ... */ });
});

describe('get_all_pending tool', () => {
  it('returns annotations across all sessions sorted oldest first', async () => { /* ... */ });
  it('excludes acknowledged, resolved, and dismissed annotations', async () => { /* ... */ });
});
```

### 7.3 Angular package tests (Karma + Angular CLI)

Angular unit tests use the Angular CLI test runner, which uses Karma and Jasmine by default. Run them with:

```bash
ng test --project=ng-annotate-demo --watch=false
```

> **Note:** Tests for the `@ng-annotate/angular` package itself live inside the demo app’s test runner. This is intentional — the Angular test utilities (`TestBed`, `ComponentFixture`) require a browser-like environment that Karma provides, and wiring up a separate Karma instance for the library package adds complexity without benefit at this stage.

#### `InspectorService` tests

The Inspector relies on `ng.*` globals that are only present in Angular’s dev mode. Tests must mock these globals explicitly.

```ts
describe('InspectorService', () => {
  let service: InspectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [InspectorService] });
    service = TestBed.inject(InspectorService);

    // Provide a minimal ng.* mock
    (window as any).ng = {
      getComponent: jasmine.createSpy('getComponent'),
      getContext: jasmine.createSpy('getContext')
    };

    // Provide a manifest mock
    (window as any).__NG_ANNOTATE_MANIFEST__ = {
      HeaderComponent: {
        component: 'src/app/header/header.component.ts',
        template: 'src/app/header/header.component.html'
      }
    };
  });

  afterEach(() => {
    delete (window as any).ng;
    delete (window as any).__NG_ANNOTATE_MANIFEST__;
  });

  it('returns null when no component is found on the element or any ancestor', () => {
    (window as any).ng.getComponent.and.returnValue(null);
    const el = document.createElement('div');
    expect(service.getComponentContext(el)).toBeNull();
  });

  it('resolves component name, selector, and file paths from the manifest', () => {
    const mockComponent = {
      constructor: {
        name: 'HeaderComponent',
        ɵcmp: { selectors: [['app-header']], inputs: {} }
      }
    };
    (window as any).ng.getComponent.and.returnValue(mockComponent);
    const el = document.createElement('app-header');

    const context = service.getComponentContext(el);

    expect(context?.componentName).toBe('HeaderComponent');
    expect(context?.selector).toBe('app-header');
    expect(context?.componentFilePath).toBe('src/app/header/header.component.ts');
    expect(context?.templateFilePath).toBe('src/app/header/header.component.html');
  });

  it('walks up the DOM to find the nearest component boundary', () => {
    const parent = document.createElement('app-header');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const mockComponent = {
      constructor: { name: 'HeaderComponent', ɵcmp: { selectors: [['app-header']], inputs: {} } }
    };
    (window as any).ng.getComponent.and.callFake((el: Element) =>
      el === parent ? mockComponent : null
    );

    const context = service.getComponentContext(child);
    expect(context?.componentName).toBe('HeaderComponent');

    document.body.removeChild(parent);
  });

  it('extracts @Input values from the component def', () => {
    const mockComponent = {
      title: 'Hello world',
      constructor: {
        name: 'HeaderComponent',
        ɵcmp: {
          selectors: [['app-header']],
          inputs: { title: 'title' }  // publicName: privateName
        }
      }
    };
    (window as any).ng.getComponent.and.returnValue(mockComponent);
    const el = document.createElement('app-header');

    const context = service.getComponentContext(el);
    expect(context?.inputs).toEqual({ title: 'Hello world' });
  });

  it('caps domSnapshot at 5000 characters', () => {
    const mockComponent = {
      constructor: { name: 'HeaderComponent', ɵcmp: { selectors: [['app-header']], inputs: {} } }
    };
    (window as any).ng.getComponent.and.returnValue(mockComponent);
    const el = document.createElement('app-header');
    // Give the element a very long outerHTML by adding a data attribute
    el.setAttribute('data-long', 'x'.repeat(6000));

    const context = service.getComponentContext(el);
    expect(context!.domSnapshot.length).toBeLessThanOrEqual(5020); // 5000 + truncation suffix
  });
});
```

#### `BridgeService` tests

```ts
describe('BridgeService', () => {
  let service: BridgeService;
  let mockWs: jasmine.SpyObj<WebSocket>;

  beforeEach(() => {
    mockWs = jasmine.createSpyObj('WebSocket', ['send', 'close'], {
      readyState: WebSocket.OPEN
    });
    spyOn(window, 'WebSocket').and.returnValue(mockWs as any);

    TestBed.configureTestingModule({ providers: [BridgeService] });
    service = TestBed.inject(BridgeService);
    service.init();
  });

  it('emits the session on session:created message', () => {
    const session = { id: 'abc', active: true, url: 'http://localhost' };
    let received: any;
    service.session$.subscribe(s => received = s);

    mockWs.onmessage!({ data: JSON.stringify({ type: 'session:created', session }) } as any);

    expect(received).toEqual(session);
  });

  it('sends annotation:create message with the correct payload', () => {
    const payload = { componentName: 'TestComponent', annotationText: 'Fix this' };
    service.createAnnotation(payload as any);

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'annotation:create', payload })
    );
  });

  it('updates annotations$ when annotations:sync is received', () => {
    const annotations = [{ id: '1', status: 'pending' }];
    service.annotations$.subscribe();

    mockWs.onmessage!({ data: JSON.stringify({ type: 'annotations:sync', annotations }) } as any);

    expect(service.annotations$.value).toEqual(annotations as any);
  });

  it('attempts reconnection after socket close', (done) => {
    (window.WebSocket as jasmine.Spy).calls.reset();
    mockWs.onclose!({} as any);

    setTimeout(() => {
      expect(window.WebSocket).toHaveBeenCalledTimes(1);
      done();
    }, 2500);
  });
});
```

#### `OverlayComponent` tests

Focus on the state machine — mode transitions are where bugs will appear.

```ts
describe('OverlayComponent', () => {
  let fixture: ComponentFixture<OverlayComponent>;
  let component: OverlayComponent;
  let inspectorSpy: jasmine.SpyObj<InspectorService>;
  let bridgeSpy: jasmine.SpyObj<BridgeService>;

  beforeEach(() => {
    inspectorSpy = jasmine.createSpyObj('InspectorService', ['getComponentContext']);
    bridgeSpy = jasmine.createSpyObj('BridgeService',
      ['createAnnotation', 'replyToAnnotation'],
      { annotations$: new BehaviorSubject([]), session$: new BehaviorSubject(null) }
    );

    TestBed.configureTestingModule({
      declarations: [OverlayComponent],
      providers: [
        { provide: InspectorService, useValue: inspectorSpy },
        { provide: BridgeService, useValue: bridgeSpy }
      ]
    });

    fixture = TestBed.createComponent(OverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts in hidden mode', () => {
    expect(component.mode).toBe('hidden');
  });

  it('transitions to inspect mode on Alt+Shift+A', () => {
    component.toggleInspect(new KeyboardEvent('keydown'));
    expect(component.mode).toBe('inspect');
  });

  it('transitions back to hidden from inspect on Alt+Shift+A', () => {
    component.mode = 'inspect';
    component.toggleInspect(new KeyboardEvent('keydown'));
    expect(component.mode).toBe('hidden');
  });

  it('transitions to annotate mode on click when a component is found', () => {
    component.mode = 'inspect';
    const context = { componentName: 'TestComponent' } as any;
    inspectorSpy.getComponentContext.and.returnValue(context);

    const el = document.createElement('div');
    document.body.appendChild(el);
    spyOn(document, 'elementFromPoint').and.returnValue(el);

    component.onClick(new MouseEvent('click', { clientX: 0, clientY: 0 }));

    expect(component.mode).toBe('annotate');
    expect(component.selectedContext).toEqual(context);
    document.body.removeChild(el);
  });

  it('pressing Escape from annotate returns to inspect', () => {
    component.mode = 'annotate';
    component.onEscape();
    expect(component.mode).toBe('inspect');
  });

  it('pressing Escape from inspect returns to hidden', () => {
    component.mode = 'inspect';
    component.onEscape();
    expect(component.mode).toBe('hidden');
  });

  it('submit calls bridge.createAnnotation and resets state', () => {
    component.mode = 'annotate';
    component.selectedContext = { componentName: 'Foo' } as any;
    component.annotationText = 'Please fix this';

    component.submit();

    expect(bridgeSpy.createAnnotation).toHaveBeenCalled();
    expect(component.mode).toBe('hidden');
    expect(component.annotationText).toBe('');
    expect(component.selectedContext).toBeNull();
  });

  it('submit does nothing if annotationText is blank', () => {
    component.mode = 'annotate';
    component.selectedContext = { componentName: 'Foo' } as any;
    component.annotationText = '   ';

    component.submit();

    expect(bridgeSpy.createAnnotation).not.toHaveBeenCalled();
    expect(component.mode).toBe('annotate');
  });
});
```

### 7.4 Integration tests (Playwright)

Integration tests run against the real demo app (dev server must be running) and exercise the complete annotation loop using a real browser. They verify that the pieces connect correctly in ways unit tests cannot.

```bash
npm install -D @playwright/test --workspace=demo
npx playwright install chromium  # headless browser binary
```

File: `demo/playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
    video: 'retain-on-failure'
  },
  // Expect the dev server to already be running — do not manage it here
  webServer: {
    command: 'bash ../scripts/dev.sh',
    url: 'http://localhost:4200',
    reuseExistingServer: true,  // don't start a new one if already running
    timeout: 30_000
  }
});
```

File: `demo/e2e/annotation-loop.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const STORE_PATH = path.join(__dirname, '../../.ng-annotate/store.json');

function readStore(): { annotations: Record<string, any> } {
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
}

test.describe('annotation overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for Angular to bootstrap and WS to connect
    await page.waitForFunction(() => !!(window as any).__NG_ANNOTATE_MANIFEST__);
  });

  test('manifest is injected and contains demo component entries', async ({ page }) => {
    const manifest = await page.evaluate(() => (window as any).__NG_ANNOTATE_MANIFEST__);
    expect(manifest).toHaveProperty('BrokenCardComponent');
    expect(manifest['BrokenCardComponent'].component).toContain('broken-card');
  });

  test('Alt+Shift+A activates inspect mode', async ({ page }) => {
    await page.keyboard.press('Alt+Shift+A');
    // Overlay hint should disappear and highlight should appear on hover
    await page.hover('app-broken-card');
    await expect(page.locator('.nga-component-label')).toBeVisible();
    await expect(page.locator('.nga-component-label')).toHaveText('BrokenCardComponent');
  });

  test('clicking a component in inspect mode opens annotation panel', async ({ page }) => {
    await page.keyboard.press('Alt+Shift+A');
    await page.click('app-broken-card');
    await expect(page.locator('.nga-panel')).toBeVisible();
    await expect(page.locator('.nga-panel')).toContainText('BrokenCardComponent');
  });

  test('submitting an annotation creates a store entry with correct context', async ({ page }) => {
    const storeBefore = readStore();
    const countBefore = Object.keys(storeBefore.annotations).length;

    await page.keyboard.press('Alt+Shift+A');
    await page.click('app-broken-card');
    await page.fill('.nga-textarea', 'Change the button label to "Submit"');
    await page.keyboard.press('Meta+Enter');

    // Wait for store to be written
    await page.waitForTimeout(500);

    const storeAfter = readStore();
    const annotations = Object.values(storeAfter.annotations);
    expect(annotations.length).toBe(countBefore + 1);

    const newest = annotations.at(-1)!;
    expect(newest.status).toBe('pending');
    expect(newest.componentName).toBe('BrokenCardComponent');
    expect(newest.componentFilePath).toContain('broken-card');
    expect(newest.annotationText).toBe('Change the button label to "Submit"');
    expect(newest.inputs).toBeDefined();
  });

  test('Escape from annotate panel returns to inspect mode', async ({ page }) => {
    await page.keyboard.press('Alt+Shift+A');
    await page.click('app-broken-card');
    await expect(page.locator('.nga-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.nga-panel')).not.toBeVisible();
    // Should still be in inspect mode — hovering should show highlight
    await page.hover('app-broken-card');
    await expect(page.locator('.nga-highlight')).toBeVisible();
  });
});
```

Add an integration test script to `scripts/`:

```bash
#!/usr/bin/env bash
# scripts/test-e2e.sh
set -euo pipefail

echo "▶ Running integration tests..."
echo "  (Dev server must be running — use 'npm run dev' first)"

cd demo && npx playwright test
```

Root `package.json`:

```json
{
  "scripts": {
    "test": "bash scripts/test.sh",
    "test:e2e": "bash scripts/test-e2e.sh"
  }
}
```

```bash
#!/usr/bin/env bash
# scripts/test.sh — run all unit tests across packages and demo
set -euo pipefail

echo "▶ Testing vite-plugin..."
npm run test --workspace=packages/vite-plugin

echo "▶ Testing mcp-server..."
npm run test --workspace=packages/mcp-server

echo "▶ Testing Angular (demo)..."
cd demo && ng test --watch=false --browsers=ChromeHeadless

echo "✓ All unit tests passed"
```

### 7.5 Coverage thresholds

Coverage is a floor, not a target. Set minimum thresholds in each Vitest config to catch accidental regression in test coverage:

```ts
// vitest.config.ts (vite-plugin and mcp-server)
coverage: {
  thresholds: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  }
}
```

The Angular tests do not enforce a numeric threshold — the test list in 7.3 is the specification of what must be covered. Add threshold enforcement once the Angular test suite is mature.

### 7.6 What not to test

- The Vite plugin’s `configureServer` hook — it starts a server, which belongs in integration tests, not unit tests
- Angular template rendering details beyond what `toBeVisible()` confirms — this is the job of Playwright
- The MCP SDK’s transport layer — test your tool logic, not the SDK
- The file locking mechanism itself — trust `proper-lockfile` and test the store behaviour that depends on it

-----

## Implementation Order

### Step 0 — Monorepo + demo app scaffold (2–3 hours)

Set up the npm workspace. Create empty package stubs for `vite-plugin`, `mcp-server`, and `angular`. Scaffold the demo Angular app with `ng new ng-annotate-demo --routing=false --style=scss` run from the repo root into the `demo/` directory. Wire up workspace dependencies and tsconfig paths. Write all helper scripts in `scripts/` and verify `npm run dev` starts and stops cleanly — run it twice in a row and confirm only one server process exists afterward. Generate all demo components with `ng generate` per section 0.7. Verify all checkpoints in Phase 0.10 before touching any tool code.

### Step 1 — ESLint (1 hour)

Install and configure ESLint across all packages and the demo app per Phase 6. Run `npm run lint` — fix any bootstrapping issues until it passes cleanly on the empty stubs. Activate the pre-commit hook. From this point, lint must pass before every commit.

### Step 2 — Store + MCP skeleton (2 hours)

Implement the file-based store. Write `store.spec.ts` and get all store tests passing before moving on — the store is the shared foundation and bugs here will surface unpredictably later. Implement the MCP server with all tools, seeding `.ng-annotate/store.json` with a hardcoded dummy annotation. Verify Claude Code connects via the demo’s `.mcp.json` and all tools behave correctly.

### Step 3 — MCP tool tests (1 hour)

Write `tools.spec.ts` for every MCP tool, including all three `watch_annotations` timing scenarios. All tests must pass before moving on.

### Step 4 — Vite plugin + WebSocket bridge (2 hours)

Implement the Vite plugin with `configureServer`. Add a temporary `<script>` block to the demo app that opens a WebSocket to `/__annotate` and sends a hardcoded annotation payload. Verify it appears in `.ng-annotate/store.json` and in `get_all_pending`. Remove the script block once proven.

### Step 5 — Watch tool validation (1 hour)

With the demo app running, call `watch_annotations` from Claude Code. Trigger a WebSocket message from the browser console. Verify the watch tool returns immediately rather than timing out.

### Step 6 — Component manifest (2 hours)

Add the Vite transform and virtual module. Write `manifest.spec.ts`. Reload the demo app and verify `window.__NG_ANNOTATE_MANIFEST__` contains entries for every demo component, including the external-template component.

### Step 7 — Inspector Service + tests (2–3 hours)

Implement `InspectorService`. Write the full Jasmine test suite per section 7.3 before wiring it into the Angular module. Run `ng test --watch=false` and confirm all pass.

### Step 8 — Angular module + BridgeService + tests (2 hours)

Implement `BridgeService` and the module. Write `BridgeService` tests. Submit a real annotation from the browser console by calling the bridge service directly. Confirm it arrives in `get_all_pending` with resolved file paths.

### Step 9 — Overlay component + tests (3–4 hours)

Write the `OverlayComponent` state machine tests first — they define the expected behaviour before you build it. Implement the overlay against the demo app’s component variety. Test hover on nested component trees, click-to-annotate on the list-rendering component. Add the thread view. Style last.

### Step 10 — First real end-to-end run (1 hour)

Annotate the deliberately broken demo component with a simple change request. Watch Claude Code pick it up, acknowledge, fix, and resolve. Verify HMR applies the change. Run `npm run demo:reset` and repeat. Iterate on `CLAUDE.md` based on what you observe.

### Step 11 — Integration tests (2 hours)

Install Playwright and implement the `annotation-loop.spec.ts` suite per section 7.4. Run `npm run test:e2e` with the dev server already running. All scenarios must pass before the project is considered complete.

### Step 12 — Status badges (1 hour)

Implement the badge overlay. Use the demo app’s component variety to verify badge positioning across different element sizes. Confirm badges survive scrolling and correctly open the thread panel on click.

-----

## Key Risks & Mitigations

**`ng.*` API stability**
Not formally public but used by Angular DevTools. Pin to Angular major versions in peer deps. The `ɵcmp` property for input/selector introspection is more fragile — add a try/catch everywhere and degrade gracefully.

**Component name collisions**
Two `HeaderComponent` classes in different modules share a name. Use selector as a secondary key in the manifest and for badge lookup. The `selector` field on the annotation is the more reliable identifier.

**Large DOM snapshots**
Cap `outerHTML` at 5KB. If the agent needs more context it can read the source file directly — the file paths are the primary reference.

**File locking on Windows**
`proper-lockfile` has known occasional issues on Windows. If you’re dev-ing on Mac/Linux this is a non-issue. If Windows support matters later, consider SQLite (via `better-sqlite3`) as a store backend instead.

**Watch tool and MCP transport timeout**
Some MCP clients impose their own tool call timeouts. 25 seconds should be well within limits for stdio transport, but if Claude Code has issues, reduce `timeoutMs` to 15 seconds.

-----

## Future Extensions

- **Screenshot capture** — Canvas API snapshot of the selected component appended to the annotation payload
- **Console error forwarding** — Uncaught errors forwarded to a new annotation automatically, with stack trace context
- **Annotation history log** — Append resolved annotations to `.ng-annotate/history.jsonl` for searchable audit trail
- **Re-open** — Allow re-submitting a resolved annotation with new text if the first fix missed the mark
- **Multi-component annotation** — Select multiple components and group them as a single compound task