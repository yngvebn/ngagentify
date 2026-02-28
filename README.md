# ng-annotate-mcp

A dev-only Angular toolchain addon that lets you annotate components directly in the browser and have an AI agent (Claude) act on those annotations in real time.

## How it works

1. Press `Alt+Shift+A` in the browser to enter inspect mode
2. Click a component and type an annotation (instruction for the agent)
3. The agent reads the annotation via MCP, edits the relevant files, and resolves it
4. The browser updates automatically

## Install

```bash
ng add @ng-annotate/angular
```

That's it. The schematic configures everything automatically:
- Adds the Vite plugin to `vite.config.ts`
- Adds `provideNgAnnotate()` to `app.config.ts`
- Creates `.mcp.json` for Claude Code

## Manual install

```bash
npm install @ng-annotate/angular @ng-annotate/vite-plugin --save-dev
```

**`vite.config.ts`**
```ts
import { defineConfig } from 'vite';
import { ngAnnotateMcp } from '@ng-annotate/vite-plugin';

export default defineConfig({
  plugins: [...ngAnnotateMcp()],
});
```

**`src/app/app.config.ts`**
```ts
import { ApplicationConfig } from '@angular/core';
import { provideNgAnnotate } from '@ng-annotate/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgAnnotate(),
  ],
};
```

No template changes needed — the overlay is injected automatically.

**`.mcp.json`** (for Claude Code)
```json
{
  "mcpServers": {
    "ng-annotate": {
      "command": "npx",
      "args": ["-y", "@ng-annotate/mcp-server"]
    }
  }
}
```

## Usage

Once installed, the workflow is:

**1. Start the dev server**
```bash
npm run dev
```

**2. Start the agent polling loop**

The MCP server exposes a `start-polling` prompt that injects the full work loop instructions into the conversation. In Claude Code, invoke it with:

```
/mcp ng-annotate start-polling
```

The agent will call `get_all_pending`, process any queued annotations, then enter a `watch_annotations` loop waiting for new ones. It runs until you end the conversation.

> The `start-polling` prompt works with any MCP-compatible AI editor. The tool descriptions also encode the loop semantics, so a capable agent can infer the workflow from the tools alone.

**3. Annotate in the browser**

Open `localhost:4200`, press `Alt+Shift+A` to enter inspect mode, click a component, type your instruction, and submit. The agent picks it up within seconds, edits the file, and the browser hot-reloads.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+A` | Toggle inspect mode |
| Click component | Open annotation panel |
| `Esc` | Cancel / go back |

## Packages

| Package | Purpose |
|---|---|
| `@ng-annotate/angular` | Angular library (overlay UI, bridge service) |
| `@ng-annotate/vite-plugin` | Vite plugin (WebSocket server, component manifest) |
| `@ng-annotate/mcp-server` | MCP server exposing tools to the AI agent |

## Dev

```bash
npm install        # install workspace deps
npm run build      # build all packages
npm run dev        # start demo at localhost:4200
npm test           # run all tests
npm run demo:reset # reset broken-card to its original state
```
