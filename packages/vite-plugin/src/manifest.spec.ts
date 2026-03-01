import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { createManifestPlugin, type ManifestEntry } from './manifest.js';
import type { Plugin, ResolvedConfig } from 'vite';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_ROOT = '/fake/project';

function makePlugin(): {
  plugin: Plugin & {
    transform: (code: string, id: string) => null;
    transformIndexHtml: (html: string) => string;
  };
  manifest: Record<string, ManifestEntry>;
} {
  const manifest: Record<string, ManifestEntry> = {};
  const plugin = createManifestPlugin(manifest) as Plugin & {
    transform: (code: string, id: string) => null;
    transformIndexHtml: (html: string) => string;
  };
  // Initialize projectRoot via configResolved
  (plugin.configResolved as (config: Partial<ResolvedConfig>) => void)({ root: FAKE_ROOT });
  return { plugin, manifest };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createManifestPlugin', () => {
  it('extracts class name and relative file path from a component file', () => {
    const { plugin, manifest } = makePlugin();
    const filePath = path.join(FAKE_ROOT, 'src/app/header/header.component.ts');
    const code = `
      @Component({ template: '<p>hello</p>' })
      export class HeaderComponent {}
    `;
    plugin.transform(code, filePath);

    expect(manifest.HeaderComponent).toBeDefined();
    expect(manifest.HeaderComponent.component).toBe('src/app/header/header.component.ts');
  });

  it('extracts templateUrl and resolves it relative to the component file', () => {
    const { plugin, manifest } = makePlugin();
    const filePath = path.join(FAKE_ROOT, 'src/app/header/header.component.ts');
    const code = `
      @Component({ templateUrl: './header.component.html' })
      export class HeaderComponent {}
    `;
    plugin.transform(code, filePath);

    expect(manifest.HeaderComponent.template).toBe('src/app/header/header.component.html');
  });

  it('ignores non-component TypeScript files', () => {
    const { plugin, manifest } = makePlugin();
    const filePath = path.join(FAKE_ROOT, 'src/app/utils/helper.ts');
    const code = `
      export function doSomething() {}
      export class HelperClass {}
    `;
    plugin.transform(code, filePath);

    expect(Object.keys(manifest)).toHaveLength(0);
  });

  it('ignores non-TypeScript files', () => {
    const { plugin, manifest } = makePlugin();
    const filePath = path.join(FAKE_ROOT, 'src/styles.scss');
    const code = `.foo { color: red; }`;
    plugin.transform(code, filePath);

    expect(Object.keys(manifest)).toHaveLength(0);
  });

  it('handles multiple components accumulating in the manifest', () => {
    const { plugin, manifest } = makePlugin();

    plugin.transform(
      `@Component({ template: '' }) export class FooComponent {}`,
      path.join(FAKE_ROOT, 'src/foo.component.ts'),
    );
    plugin.transform(
      `@Component({ template: '' }) export class BarComponent {}`,
      path.join(FAKE_ROOT, 'src/bar.component.ts'),
    );

    expect(Object.keys(manifest)).toHaveLength(2);
    expect(manifest.FooComponent).toBeDefined();
    expect(manifest.BarComponent).toBeDefined();
  });

  it('injects empty manifest placeholder script tag into the HTML head', () => {
    const { plugin } = makePlugin();
    const html = plugin.transformIndexHtml('<html><head><title>App</title></head><body></body></html>');
    expect(html).toContain('window.__NG_ANNOTATE_MANIFEST__');
    expect(html).toContain('</head>');
  });
});
