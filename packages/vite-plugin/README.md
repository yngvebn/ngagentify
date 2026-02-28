# @ng-annotate/vite-plugin

Vite plugin for [ng-annotate-mcp](https://github.com/yngvebn/ngagentify) — a dev-only toolchain addon that lets you annotate components in the browser and have an AI agent act on those annotations in real time.

> Heavily inspired by [agentation.dev](https://agentation.dev/) — check it out for the original concept.

> **Angular CLI users:** you don't need this package. `@ng-annotate/angular` ships its own custom `dev-server` builder that handles everything. This plugin is for other Vite-based projects (Vue, Svelte, plain Vite, etc.).

## What this plugin does

- Injects a WebSocket handler at `/__annotate` that the overlay uses to send annotations to the store
- Injects `window.__NG_ANNOTATE_MANIFEST__` into the served HTML — a map of component selectors to their source file paths, enabling the AI agent to find the right file to edit

## Install

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
| [`@ng-annotate/angular`](https://www.npmjs.com/package/@ng-annotate/angular) | Angular library (overlay UI, `provideNgAnnotate()`, custom dev-server builder) |
| [`@ng-annotate/mcp-server`](https://www.npmjs.com/package/@ng-annotate/mcp-server) | MCP server exposing tools to the AI agent |

## License

MIT
