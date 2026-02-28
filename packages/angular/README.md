# @ng-annotate/angular

Angular library for [ng-annotate-mcp](https://github.com/yngvebn/ngagentify) — a dev-only toolchain addon that lets you annotate components directly in the browser and have an AI agent (Claude) act on those annotations in real time.

## How it works

1. Press `Alt+Shift+A` in the browser to enter inspect mode
2. Click any component and type an annotation (instruction for the agent)
3. The agent reads the annotation via MCP, edits the relevant files, and resolves it
4. The browser hot-reloads automatically

## Install

```bash
ng add @ng-annotate/angular
```

The schematic configures everything automatically:
- Switches the Angular dev server to `@ng-annotate/angular:dev-server` (handles WebSocket + manifest injection — no separate config file or proxy needed)
- Adds `provideNgAnnotate()` to `app.config.ts`
- Creates the MCP config file for your AI editor (`.mcp.json` for Claude Code, `.vscode/mcp.json` for VS Code, or both)

Works with both `@angular/build:dev-server` and the legacy `@angular-devkit/build-angular:dev-server` builder.

## Manual install

```bash
npm install @ng-annotate/angular --save-dev
```

**`angular.json`** — change the serve builder:
```json
{
  "projects": {
    "your-app": {
      "architect": {
        "serve": {
          "builder": "@ng-annotate/angular:dev-server"
        }
      }
    }
  }
}
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

## Usage

Once installed:

**1. Start the dev server**
```bash
ng serve
```

**2. Start the agent polling loop**

Tell your agent to watch for annotations. In Claude Code:
```
/mcp ng-annotate start-polling
```

The agent will drain any queued annotations and then enter a `watch_annotations` loop — processing browser annotations as they arrive and editing files automatically. It runs until you end the conversation.

> The `start-polling` prompt works with any MCP-compatible AI editor.

**3. Annotate in the browser**

Open your Angular app in the browser, press `Alt+Shift+A` to enter inspect mode, click a component, type your instruction, and submit. The agent picks it up within seconds, edits the file, and the browser hot-reloads.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+A` | Toggle inspect mode |
| Click component | Open annotation panel |
| `Esc` | Cancel / go back |

## API

### `provideNgAnnotate()`

Standalone providers function for Angular 21+. Registers `InspectorService`, `BridgeService`, and dynamically mounts the overlay component to `document.body` during app initialization. Only active in dev mode.

```ts
import { provideNgAnnotate } from '@ng-annotate/angular';

export const appConfig: ApplicationConfig = {
  providers: [provideNgAnnotate()],
};
```

### `NgAnnotateModule`

For NgModule-based apps:

```ts
import { NgAnnotateModule } from '@ng-annotate/angular';

@NgModule({
  imports: [NgAnnotateModule],
})
export class AppModule {}
```

## Related packages

| Package | Purpose |
|---|---|
| [`@ng-annotate/mcp-server`](https://www.npmjs.com/package/@ng-annotate/mcp-server) | MCP server exposing tools to the AI agent |
| [`@ng-annotate/vite-plugin`](https://www.npmjs.com/package/@ng-annotate/vite-plugin) | For non-Angular-CLI Vite projects (Vue, Svelte, etc.) |

## License

MIT
