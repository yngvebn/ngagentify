import type { Plugin } from 'vite';
import { createWsHandler } from './ws-handler.js';
import { createManifestPlugin } from './manifest.js';

// Default export for Angular's angular.json `plugins` option — Angular calls it as a function.
export default ngAnnotateMcp;

export function ngAnnotateMcp(): Plugin[] {
  const mainPlugin: Plugin = {
    name: 'ng-annotate-mcp',
    apply: 'serve',

    configureServer(server) {
      createWsHandler(server);
    },
  };

  return [mainPlugin, createManifestPlugin()];
}
