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
- Adds the Vite plugin to `vite.config.ts`
- Adds `provideNgAnnotate()` to `app.config.ts`
- Creates the MCP config file for your AI editor

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
| [`@ng-annotate/vite-plugin`](https://www.npmjs.com/package/@ng-annotate/vite-plugin) | Vite plugin (WebSocket server, component manifest) |
| [`@ng-annotate/mcp-server`](https://www.npmjs.com/package/@ng-annotate/mcp-server) | MCP server exposing tools to the AI agent |

## License

MIT
