import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export interface ManifestEntry {
  component: string;
  template?: string;
}

export function createManifestPlugin(): Plugin {
  const manifest: Record<string, ManifestEntry> = {};
  let projectRoot = '';

  return {
    name: 'ng-annotate-mcp:manifest',

    configResolved(config: ResolvedConfig) {
      projectRoot = config.root;
    },

    transform(code: string, id: string) {
      if (!id.endsWith('.ts') || !code.includes('@Component')) return null;

      // Extract class name
      const classMatch = /export\s+class\s+(\w+)/.exec(code);
      if (!classMatch) return null;
      const className = classMatch[1];

      // Compute relative path from project root
      const relPath = path.relative(projectRoot, id).replace(/\\/g, '/');

      // Extract templateUrl if present
      const templateMatch = /templateUrl\s*:\s*['"`]([^'"`]+)['"`]/.exec(code);
      const entry: ManifestEntry = { component: relPath };

      if (templateMatch) {
        const templateAbsPath = path.resolve(path.dirname(id), templateMatch[1]);
        entry.template = path.relative(projectRoot, templateAbsPath).replace(/\\/g, '/');
      }

      manifest[className] = entry;
      return null;
    },

    transformIndexHtml(html: string) {
      const scriptTag = `<script>window.__NG_ANNOTATE_MANIFEST__ = ${JSON.stringify(manifest)};</script>`;
      return html.replace('</head>', `  ${scriptTag}\n</head>`);
    },
  };
}
