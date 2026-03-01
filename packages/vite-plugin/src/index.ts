import type { Plugin } from 'vite';
import { createWsHandler } from './ws-handler.js';
import { createManifestPlugin, type ManifestEntry } from './manifest.js';
import { setProjectRoot, getStorePath } from './store.js';

// Default export for Angular's angular.json `plugins` option — Angular calls it as a function.
export default ngAnnotateMcp;

export function ngAnnotateMcp(): Plugin[] {
  const manifest: Record<string, ManifestEntry> = {};

  const mainPlugin: Plugin = {
    name: 'ng-annotate-mcp',
    apply: 'serve',

    configResolved(config) {
      setProjectRoot(config.root);
    },

    configureServer(server) {
      console.log(`[ng-annotate] store → ${getStorePath()}`);

      // Serve manifest on demand via HTTP endpoint.
      server.middlewares.use((req, res, next) => {
        if (req.url === '/__annotate/manifest' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(manifest));
          return;
        }
        next();
      });

      createWsHandler(server, () => manifest);
    },
  };

  return [mainPlugin, createManifestPlugin(manifest)];
}
