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
npm install @ng-annotate/angular ng-annotate-mcp --save-dev
```

**`vite.config.ts`**
```ts
import { defineConfig } from 'vite';
import { ngAnnotateMcp } from 'ng-annotate-mcp';

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

Open the project in Claude Code and tell it to start watching:

> "Start the ng-annotate polling loop"

The agent will call `get_all_pending`, process any queued annotations, then enter a `watch_annotations` loop waiting for new ones. It runs until you end the conversation.

> **Claude Code users:** `CLAUDE.md` in your project root contains the full agent instructions. The agent will follow them automatically — just start a conversation and ask it to begin polling.

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
| `ng-annotate-mcp` | Vite plugin (WebSocket server, component manifest) |
| `@ng-annotate/mcp-server` | MCP server exposing tools to the AI agent |

## Dev

```bash
npm install        # install workspace deps
npm run build      # build all packages
npm run dev        # start demo at localhost:4200
npm test           # run all tests
npm run demo:reset # reset broken-card to its original state
```
