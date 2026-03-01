# How ng-annotate-mcp Works

A technical deep-dive into the architecture of ng-annotate-mcp — how the browser, dev server, file store, and AI agent are wired together.

---

## Summaries

### `@ng-annotate/angular`
The Angular-side package. It installs a browser overlay that lets the developer highlight any rendered component, type an instruction, and submit it. Under the hood it uses Angular's private dev-mode APIs (`ng.getComponent`) to resolve which component class owns the clicked element, then sends a richly structured annotation over a WebSocket to the dev server. The package also ships a custom Angular CLI builder that replaces `ng serve`, attaching the WebSocket endpoint and manifest injection to the existing Angular dev server without requiring a separate process or any Vite config.

### `@ng-annotate/mcp-server`
Runs as a subprocess in the AI agent's IDE (Claude Code, VS Code). It exposes the annotation store to the agent as MCP tools — read, acknowledge, resolve, dismiss, reply. The key tool is `watch_annotations`: a long-poll that returns as soon as a pending annotation appears, driving a tight event loop without any agent-side timers. The server reads and writes the same flat JSON file (`store.json`) that the Angular builder writes to, with no network connection between the two processes.

### `@ng-annotate/vite-plugin`
The equivalent of the Angular builder's WebSocket + manifest logic, packaged as a standard Vite plugin for non-Angular-CLI projects (plain Vite, Vue, Svelte, etc.). It is **not** used when `@ng-annotate/angular` is installed in an Angular CLI project — the custom builder handles everything.

---

## Architecture overview

```
┌─────────────────────────────────────────────┐
│                  Browser                    │
│                                             │
│  Angular app                                │
│  ┌──────────────────────────────────────┐   │
│  │  OverlayComponent                   │   │
│  │  - Alt+Shift+A → inspect mode       │   │
│  │  - click → InspectorService         │   │
│  │  - submit → BridgeService           │   │
│  └───────────────┬──────────────────────┘   │
│                  │ WebSocket ws://./__annotate
└──────────────────┼──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        Angular dev server (ng serve)        │
│        @ng-annotate/angular:dev-server      │
│                                             │
│  - WebSocket handler at /__annotate         │
│  - Reads/writes .ng-annotate/store.json     │
│  - Injects window.__NG_ANNOTATE_MANIFEST__  │
│  - 2s sync loop → browser badges           │
└──────────────────┬──────────────────────────┘
                   │ shared filesystem
┌──────────────────▼──────────────────────────┐
│         .ng-annotate/store.json             │
│  { sessions: {…}, annotations: {…} }        │
└──────────────────┬──────────────────────────┘
                   │ reads / writes
┌──────────────────▼──────────────────────────┐
│        @ng-annotate/mcp-server              │
│        (subprocess in IDE)                  │
│                                             │
│  MCP tools: watch_annotations, acknowledge, │
│  resolve, dismiss, reply, list_sessions …   │
└──────────────────┬──────────────────────────┘
                   │ MCP (stdio)
┌──────────────────▼──────────────────────────┐
│           AI agent (Claude Code)            │
│                                             │
│  - Calls watch_annotations in a loop       │
│  - Reads component files from disk         │
│  - Edits files, calls resolve              │
└─────────────────────────────────────────────┘
```

The store is the only shared state between the dev server and the MCP server. There is no network connection between them. Both processes read and write the same JSON file on the local filesystem.

---

## Package 1: `@ng-annotate/angular`

### 1.1 Setup — `provideNgAnnotate()` and `NgAnnotateModule`

Both entry points do the same thing: during Angular's app initialiser phase, they call `bridge.init()` and then dynamically create `OverlayComponent` and attach it to `document.body`:

```ts
const overlayRef = createComponent(OverlayComponent, { environmentInjector: envInjector });
appRef.attachView(overlayRef.hostView);
document.body.appendChild(overlayRef.location.nativeElement);
```

Using `createComponent` / `appRef.attachView` means the overlay lives in Angular's change-detection tree but is appended outside any existing component hierarchy. It is guarded by `isDevMode()` so it compiles away in production builds.

### 1.2 `InspectorService` — resolving components from DOM elements

When the user clicks an element in inspect mode, `InspectorService.getComponentContext(element)` is called. It uses Angular's global `ng.getComponent(el)` dev-mode API to walk up the DOM until it finds an element that is the host node of an Angular component:

```ts
private findNearestComponent(element: Element): unknown {
  let current: Element | null = element;
  while (current) {
    const comp = ng.getComponent(current);
    if (comp) return comp;
    current = current.parentElement;
  }
  return null;
}
```

The manual walk using `ng.getComponent` is deliberate. Angular also exposes `ng.getOwningComponent(el)`, which returns the component whose *template* contains `el` — the parent's perspective. That gives the wrong answer when the user clicks a component's own host element: `getOwningComponent(<app-card>)` returns the parent that placed `<app-card>` in its template, not `AppCard` itself. `getComponent` only returns non-null when `el` is a component host element, so walking up the DOM stops at the exact component the developer clicked on.

Once a component instance is found, the service extracts:

- **`componentName`** — the class name from `component.constructor.name`
- **`selector`** — from `component.constructor.ɵcmp.selectors` (Angular's compiled component definition)
- **`inputs`** — current input property values, enumerated via `ɵcmp.inputs`
- **`componentFilePath` / `templateFilePath`** — looked up in `window.__NG_ANNOTATE_MANIFEST__`, the component-to-file map injected by the dev server at page load
- **`domSnapshot`** — `element.outerHTML` (truncated at 5 000 chars)
- **`componentTreePath`** — class names of all ancestor Angular components, built by walking up `parentElement` and calling `ng.getComponent` at each level

This context is what the AI agent receives in an annotation — it tells the agent exactly which TypeScript file and template file to edit.

### 1.3 `BridgeService` — WebSocket client

`BridgeService` opens a WebSocket to `ws://<host>/__annotate` on `init()`. Messages it sends:

| Message type | Payload | When |
|---|---|---|
| `annotation:create` | Full `ComponentContext` + `annotationText` + optional `selectionText` | User submits annotation |
| `annotation:reply` | `{ id, message }` | User sends a reply from the thread panel |

Messages it receives:

| Message type | Effect |
|---|---|
| `session:created` | Stores the session object in `session$` |
| `annotation:created` | Appends annotation to `annotations$` |
| `annotations:sync` | Replaces entire `annotations$` array (2-second heartbeat from server) |
| `manifest:update` | Updates `window.__NG_ANNOTATE_MANIFEST__` |

`BridgeService` reconnects automatically every 3 seconds on close.

### 1.4 `OverlayComponent` — the browser UI

A single `position: fixed; width: 100%; height: 100%; pointer-events: none` host element covers the full viewport. Child elements selectively re-enable pointer events.

The component manages a state machine with four modes:

```
hidden ──Alt+Shift+A──► inspect ──click component──► annotate ──submit──► inspect
  ▲                        │                              │
  │                        Esc                           Esc
  │                        │                              │
  └────────────────────────┘◄─────────────────────────────┘

hidden ◄──closeThread── thread ◄──badge click── (any mode)
```

**Inspect mode:** `mousemove` events update a blue highlight rect (`nga-highlight-rect`) positioned over the hovered component using `getBoundingClientRect()`. The component label appears 22 px above the rect.

**Annotate mode:** A floating panel appears on the right side. It shows the component name, its current inputs, optional selected text, and a textarea. `Shift+Enter` submits (via `(keydown.shift.enter)` binding).

**Annotation badges:** When `annotations$` emits, each annotation is mapped to a small circular badge positioned over its component using `getBoundingClientRect()`. Badges are re-positioned on `window:scroll` and `window:resize`. Badge colours indicate status:
- Blue (`#3b82f6`) — pending
- Amber (`#f59e0b`) — acknowledged
- Green (`#22c55e`) — resolved
- Grey (`#94a3b8`) — dismissed

Clicking a badge opens the thread panel showing the reply history.

### 1.5 The custom dev-server builder

The builder (`@ng-annotate/angular:dev-server`) wraps Angular's own `executeDevServerBuilder` from `@angular/build`, adding two extensions:

**`middleware`** — A Connect-style middleware function that runs on the first HTTP request. It grabs a reference to the underlying `http.Server` via `req.socket.server`, attaches an `upgrade` event listener, and hands `/__annotate` WebSocket upgrades off to a `WebSocketServer` (from the `ws` package). This is necessary because Angular's dev server does not expose a hook for WebSocket upgrades — the middleware trick reaches through to the raw Node.js HTTP server.

**`indexHtmlTransformer`** — A function that receives the fully built `index.html` string and injects:
```html
<script>window.__NG_ANNOTATE_MANIFEST__ = { "AppComponent": { "component": "src/app/app.ts" }, … };</script>
```
The manifest is built at startup by scanning all `.ts` files under `src/` for `@Component` decorators, extracting class names and resolving `templateUrl` paths.

> **Why a manifest at all?** Angular's compiler resolves `templateUrl` at build time and compiles the template into a JavaScript function — the original file path is not preserved in the runtime output. `ɵcmp` (the compiled component definition) holds selectors, inputs, and the compiled template function, but not source paths. Sourcemaps are not useful here either: they map compiled JS lines back to their source lines, but do not expose component-to-file relationships in a form that a page script can consume. Angular DevTools solves the same problem via the Chrome DevTools Protocol (a privileged browser-extension API), which is unavailable to ordinary page scripts. Angular 17+ adds `ɵcmp.debugInfo` which may include `filePath`, but it carries a private `ɵ` prefix indicating it is intentionally unstable across releases.
>
> **Size caveat:** The builder scans all `.ts` files eagerly at startup and inlines the full manifest into every page load. For large projects (500+ components) this can reach 100–200 KB of inline JSON. A better approach would be to serve the manifest from a dedicated `/__annotate/manifest` HTTP endpoint and fetch it lazily on first use. The `@ng-annotate/vite-plugin` already avoids this problem by using Vite's `transform` hook, which builds the manifest incrementally as modules are loaded rather than scanning everything upfront.

**Store location** — The builder calls `findStoreRoot(context.workspaceRoot)`, which walks up the directory tree from the Angular workspace root until it finds a `.git` directory. This ensures that in a monorepo (Angular project is a subdirectory of the git root), both the builder and the MCP server write to and read from the same `store.json` file at the git root.

**Schema** — The builder's `schema.json` mirrors Angular's own `@angular/build:dev-server` schema exactly. This is important: if the schema has empty `properties`, Angular CLI silently drops all options before calling `executeDevServerBuilder`, breaking `buildTarget`, `watch`, `liveReload`, and `hmr`.

### 1.6 `ng add` schematic

Running `ng add @ng-annotate/angular` executes a chain of five rules:

1. **`checkAngularVersion`** — reads `package.json`, parses the `@angular/core` version, and throws if it is below Angular 21.

2. **`addDevDependency`** — moves `@ng-annotate/angular` from `dependencies` to `devDependencies` (Angular CLI puts it in `dependencies` by default), adds `@ng-annotate/mcp-server: "latest"` to `devDependencies`, and schedules `NodePackageInstallTask`.

3. **`updateAngularJsonBuilder`** — finds every project in `angular.json` whose `architect.serve.builder` is `@angular/build:dev-server` or the legacy `@angular-devkit/build-angular:dev-server`, and replaces it with `@ng-annotate/angular:dev-server`.

4. **`addProviders`** — finds `src/app/app.config.ts` (or a few alternate candidates), inserts `import { provideNgAnnotate } from '@ng-annotate/angular'` after the last existing import, and adds `provideNgAnnotate()` as the first entry in the `providers` array. Both insertions use regex-based AST-free text manipulation.

5. **`addMcpConfig`** — creates `.mcp.json` (Claude Code) and/or `.vscode/mcp.json` (VS Code Copilot) depending on the `aiTool` prompt option. The `NG_ANNOTATE_PROJECT_ROOT` environment variable is set to the **git root** (not the Angular project dir), so the MCP server reads from the same location the builder writes to. In a monorepo, config files are written to both the Angular subdir (via Tree) and the git root (via `fs.writeFileSync`, bypassing the Tree).

6. **`addGitignore`** — adds `.ng-annotate/` to the Angular project's `.gitignore` (via Tree), and for monorepos also updates the git root's `.gitignore` directly on the filesystem.

---

## Package 2: `@ng-annotate/mcp-server`

### 2.1 Transport

The server uses the MCP SDK's `StdioServerTransport`. It communicates with the IDE exclusively over stdin/stdout — no ports, no network sockets. The IDE (Claude Code or VS Code) spawns the server as a child process and speaks the MCP protocol over stdio.

### 2.2 The store

`store.ts` is a thin wrapper over `store.json`. The store shape is:

```json
{
  "sessions": {
    "<uuid>": { "id": "…", "createdAt": "…", "lastSeenAt": "…", "active": true, "url": "…" }
  },
  "annotations": {
    "<uuid>": {
      "id": "…", "sessionId": "…", "createdAt": "…", "status": "pending",
      "replies": [],
      "componentName": "…", "componentFilePath": "…", "templateFilePath": "…",
      "selector": "…", "inputs": {}, "domSnapshot": "…", "componentTreePath": [],
      "annotationText": "…", "selectionText": "…"
    }
  }
}
```

**Write serialisation** — All writes go through `withLock`, an in-process promise queue. Each write enqueues a callback that reads the current file, applies the change, and writes it back. The queue is never broken by a failing task (errors are caught and re-thrown to the caller only). This is sufficient for single-process correctness; the two processes (builder and MCP server) write to the same file but almost never simultaneously in practice.

**Store location** — `PROJECT_ROOT` is resolved once at startup: `process.env.NG_ANNOTATE_PROJECT_ROOT ?? findGitRoot(process.cwd())`. The env var is set by the generated `.mcp.json` (to the git root). When absent, `findGitRoot` walks up from `process.cwd()` until it finds a `.git` directory, so the server is location-independent when used without the schematic.

### 2.3 MCP tools

All tools are registered in `tools.ts` via `server.registerTool`. Each tool returns either `json(data)` (a text/JSON content block) or `error(message)` (with `isError: true`).

| Tool | What it does |
|---|---|
| `list_sessions` | Returns all sessions (active and inactive) |
| `get_session` | Returns one session and all its annotations |
| `get_pending` | Returns pending annotations for a given session ID |
| `get_all_pending` | Returns all pending annotations across all sessions, sorted oldest-first |
| `acknowledge` | Sets status `pending → acknowledged`; optionally adds a reply |
| `resolve` | Sets status → `resolved`; optionally adds a summary reply |
| `dismiss` | Sets status → `dismissed`; requires a reason (stored as a reply) |
| `reply` | Adds an agent reply without changing status (used to ask for clarification) |
| `watch_annotations` | Long-poll: returns immediately if pending annotations exist, otherwise polls every 500 ms until annotations appear or the timeout (default 25 s) expires |

### 2.4 `watch_annotations` — the event loop primitive

This is the core of the agent's work loop. It avoids the agent burning tokens by polling aggressively:

```
check immediately → any pending? return them
                  ↓ no
setInterval every 500ms → pending? clear interval + timer, return them
setTimeout after 25s   → clear interval, return { status: "timeout" }
```

On timeout the response includes `storePath`, `activeSessions`, and a hint explaining what the agent should do next (e.g., "no browser sessions connected — open the app"). This gives the agent enough context to diagnose connectivity issues without human intervention.

### 2.5 The `start-polling` prompt

Registered via `server.registerPrompt`, this injects a structured natural-language work loop into the conversation when the user runs `/mcp ng-annotate start-polling`. It tells the agent to:

1. Call `get_all_pending` to drain annotations that arrived before the agent connected
2. Process each annotation (acknowledge → read files → edit → resolve/reply/dismiss)
3. Enter the `watch_annotations` loop indefinitely

This is purely informational — a capable agent can infer the protocol from the tool descriptions alone.

### 2.6 Annotation lifecycle

```
pending → acknowledged → resolved
                       → dismissed
        → (reply added, status unchanged)
```

`pending` is the only status the agent acts on. `acknowledged` signals to the browser (via the 2-second sync) that the agent is working. `resolved` and `dismissed` are terminal states. Replies accumulate in the `replies` array regardless of status — they form a thread visible in the browser's overlay panel.

---

## Package 3: `@ng-annotate/vite-plugin`

This package provides the same two capabilities as the Angular builder — WebSocket handling and manifest injection — but as standard Vite plugin hooks, for use outside Angular CLI.

### 3.1 WebSocket handler (`ws-handler.ts`)

Hooks into `server.httpServer.on('upgrade', …)` to intercept WebSocket upgrade requests at `/__annotate`. Uses a `WebSocketServer` in `noServer` mode and calls `handleUpgrade` manually so it can coexist with Vite's own HMR WebSocket on the same port.

On connection:
1. Creates a session in the store, sends `session:created` back to the browser
2. Listens for `annotation:create`, `annotation:reply`, and `annotation:delete` messages
3. On `annotation:create`, writes to the store and sends `annotation:created` back
4. On close, marks the session as inactive

A `setInterval` running every 2 seconds pushes `annotations:sync` to each connected socket, keeping badge status in the browser up to date after the agent resolves annotations.

### 3.2 Manifest plugin (`manifest.ts`)

Uses Vite's `transform` hook (called for every module as it is compiled) to detect TypeScript files containing `@Component`. For each one it extracts the class name and resolves the `templateUrl` (if any) relative to the project root. The manifest is accumulated in a closure over the plugin's lifetime.

The `transformIndexHtml` hook injects the accumulated manifest into the served HTML as an inline `<script>` tag before `</head>`. Because `transform` runs on-demand as modules are loaded, the manifest is incrementally complete — early page loads may have a partial manifest, but all components used by the app will be present by the time the developer interacts with them.

### 3.3 Store (`store.ts`)

Identical in structure to the MCP server's store, but uses a mutable `projectRoot` variable (set via `setProjectRoot` from the `configResolved` Vite hook) rather than an env var or git-root walk. The Vite plugin does not need to find the git root because it always runs in the context of the Vite project.

---

## Data flow: end to end

Here is the complete sequence for one annotation being created and resolved:

```
1. Developer presses Alt+Shift+A in the browser
   → OverlayComponent sets mode = 'inspect'

2. Developer moves mouse, clicks a component
   → InspectorService.getComponentContext(element)
     → ng.getComponent(element) [Angular dev-mode API]
     → reads window.__NG_ANNOTATE_MANIFEST__ for file paths
   → OverlayComponent sets mode = 'annotate', shows panel

3. Developer types instruction, presses Shift+Enter
   → BridgeService.createAnnotation({ ...context, annotationText })
   → sends { type: 'annotation:create', payload: { … } } over WebSocket

4. Dev server WebSocket handler receives message
   → store.createAnnotation({ sessionId, componentName, componentFilePath,
       templateFilePath, selector, inputs, domSnapshot,
       componentTreePath, annotationText, selectionText })
   → writes to .ng-annotate/store.json
   → sends { type: 'annotation:created', annotation } back to browser

5. Browser BridgeService receives annotation:created
   → updates annotations$ BehaviorSubject
   → OverlayComponent renders a blue pending badge over the component

6. MCP server watch_annotations tool (running in agent's IDE)
   → polling loop detects new pending annotation
   → returns { status: 'annotations', annotations: [{ id, componentFilePath,
       templateFilePath, annotationText, selectionText, … }] }

7. Agent calls acknowledge({ id })
   → store sets status = 'acknowledged'
   → next 2s sync sends annotations:sync to browser
   → badge turns amber

8. Agent reads componentFilePath and templateFilePath from disk
   → edits the file(s) to implement the instruction
   → Angular HMR reloads the browser

9. Agent calls resolve({ id, summary: 'Added null check to getUser()' })
   → store sets status = 'resolved', appends reply
   → next 2s sync → badge turns green

10. Developer sees green badge, clicks it to read the summary thread
```

---

## Monorepo behaviour

Both the Angular builder and the MCP server independently walk up the directory tree from their respective starting points to locate the nearest `.git` directory. This means the store is always placed at the git root, regardless of where VS Code or Claude Code happens to be opened.

The `ng add` schematic reflects the same logic: `NG_ANNOTATE_PROJECT_ROOT` in the generated `.mcp.json` is set to the resolved git root (not `process.cwd()`). Config files (`.mcp.json`, `.vscode/mcp.json`, `.gitignore` entries) are written to both the Angular project directory and the git root so they are found whether the IDE is opened at either level.

Multiple Angular projects in the same repository share one `store.json`. They are separated by `sessionId` — each browser tab gets its own session on WebSocket connection, and all MCP query tools support filtering by `sessionId`.

---

## What is not in the critical path

- **No daemon process** — the MCP server and dev server are independent processes that never talk to each other
- **No database** — `store.json` is a plain JSON file; reads are synchronous, writes are promise-chained
- **No build step for schematics** — schematics are compiled to CommonJS `.js` files alongside their `.ts` sources and published as-is; the Angular library itself uses ng-packagr for ESM output
- **No Angular zone issues** — `BridgeService` wraps all WebSocket callbacks in `NgZone.run()` so change detection fires correctly without `async`/`await` leaking outside the zone
