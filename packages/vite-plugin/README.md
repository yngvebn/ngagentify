# @ng-annotate/vite-plugin

Vite plugin for [ng-annotate-mcp](https://github.com/yngvebn/ngagentify) — a dev-only Angular toolchain addon that lets you annotate components in the browser and have an AI agent act on those annotations in real time.

## What this plugin does

- Injects a WebSocket handler at `/__annotate` that the Angular overlay uses to send annotations to the store
- Injects `window.__NG_ANNOTATE_MANIFEST__` into the served HTML — a map of component selectors to their source file paths, enabling the AI agent to find the right file to edit

## Install

```bash
ng add @ng-annotate/angular
```

The schematic configures the plugin automatically. For manual setup:

```bash
npm install @ng-annotate/vite-plugin --save-dev
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { ngAnnotateMcp } from '@ng-annotate/vite-plugin';

export default defineConfig({
  plugins: [...ngAnnotateMcp()],
});
```

## Related packages

| Package | Purpose |
|---|---|
| [`@ng-annotate/angular`](https://www.npmjs.com/package/@ng-annotate/angular) | Angular library (overlay UI, `provideNgAnnotate()`) |
| [`@ng-annotate/mcp-server`](https://www.npmjs.com/package/@ng-annotate/mcp-server) | MCP server exposing tools to the AI agent |

## License

MIT
