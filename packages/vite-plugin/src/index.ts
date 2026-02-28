import type { Plugin } from 'vite';
import { createWsHandler } from './ws-handler.js';
import { createManifestPlugin } from './manifest.js';
import { setProjectRoot, getStorePath } from './store.js';

// Default export for Angular's angular.json `plugins` option — Angular calls it as a function.
export default ngAnnotateMcp;

export function ngAnnotateMcp(): Plugin[] {
  const mainPlugin: Plugin = {
    name: 'ng-annotate-mcp',
    apply: 'serve',

    configResolved(config) {
      setProjectRoot(config.root);
    },

    configureServer(server) {
      console.log(`[ng-annotate] store → ${getStorePath()}`);
      createWsHandler(server);
    },
  };

  return [mainPlugin, createManifestPlugin()];
}
