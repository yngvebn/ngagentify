import { describe, it, expect } from 'vitest';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Tree } from '@angular-devkit/schematics';
import * as path from 'path';
import { insertAfterLastImport, insertIntoProviders } from './helpers';

// ─── Helper unit tests ────────────────────────────────────────────────────────

describe('insertAfterLastImport', () => {
  it('inserts after a single import', () => {
    const input = `import { Foo } from 'foo';\n\nexport const x = 1;\n`;
    const result = insertAfterLastImport(input, "import { Bar } from 'bar';");
    expect(result).toContain("import { Foo } from 'foo';\nimport { Bar } from 'bar';");
  });

  it('inserts after consecutive imports', () => {
    const input = `import { A } from 'a';\nimport { B } from 'b';\n\nexport const x = 1;\n`;
    const result = insertAfterLastImport(input, "import { C } from 'c';");
    expect(result).toContain("import { B } from 'b';\nimport { C } from 'c';");
    expect(result).not.toContain("import { A } from 'a';\nimport { C }");
  });

  it('inserts after last group when imports are separated by blank lines', () => {
    const input = `import { A } from 'a';\nimport { B } from 'b';\n\nimport { C } from 'c';\n\nexport const x = 1;\n`;
    const result = insertAfterLastImport(input, "import { D } from 'd';");
    expect(result).toContain("import { C } from 'c';\nimport { D } from 'd';");
  });

  it('handles multi-line imports', () => {
    const input = `import {\n  ApplicationConfig,\n  provideZoneChangeDetection,\n} from '@angular/core';\nimport { provideRouter } from '@angular/router';\n\nexport const x = 1;\n`;
    const result = insertAfterLastImport(input, "import { provideNgAnnotate } from '@ng-annotate/angular';");
    // Should insert after the last complete import, not inside the multi-line one
    expect(result).toContain("import { provideRouter } from '@angular/router';\nimport { provideNgAnnotate }");
    expect(result).not.toMatch(/import \{\nimport/);
  });

  it('prepends when no imports exist', () => {
    const input = `export const x = 1;\n`;
    const result = insertAfterLastImport(input, "import { Foo } from 'foo';");
    expect(result).toMatch(/^import \{ Foo \}/);
  });
});

describe('insertIntoProviders', () => {
  it('inserts into inline providers array', () => {
    const input = `export const appConfig = {\n  providers: [provideRouter(routes)],\n};\n`;
    const result = insertIntoProviders(input, 'provideNgAnnotate()');
    expect(result).toContain('providers: [\n    provideNgAnnotate(),');
    expect(result).toContain('provideRouter(routes)');
  });

  it('inserts into multi-line providers array', () => {
    const input = `export const appConfig = {\n  providers: [\n    provideRouter(routes),\n  ],\n};\n`;
    const result = insertIntoProviders(input, 'provideNgAnnotate()');
    expect(result).toContain('providers: [\n    provideNgAnnotate(),');
  });

  it('respects existing indentation', () => {
    const input = `export const appConfig = {\n    providers: [provideRouter(routes)],\n};\n`;
    const result = insertIntoProviders(input, 'provideNgAnnotate()');
    expect(result).toContain('    providers: [\n      provideNgAnnotate(),');
  });
});

// ─── Schematic integration tests ─────────────────────────────────────────────

const collectionPath = path.join(__dirname, '../collection.json');
const runner = new SchematicTestRunner('ng-annotate', collectionPath);

const BASE_PKG = JSON.stringify({
  dependencies: { '@angular/core': '^21.0.0' },
  devDependencies: {},
});

const ANGULAR_JSON = JSON.stringify({
  projects: {
    'my-app': {
      architect: {
        serve: {
          builder: '@angular/build:dev-server',
          options: {},
        },
      },
    },
  },
});

async function runSchematic(tree: Tree): Promise<ReturnType<typeof Tree.empty> & { readText(p: string): string }> {
  return runner.runSchematic('ng-add', { aiTool: 'claude-code' }, tree) as Promise<ReturnType<typeof Tree.empty> & { readText(p: string): string }>;
}

function makeTree(files: Record<string, string>): Tree {
  const tree = Tree.empty();
  for (const [filePath, content] of Object.entries(files)) {
    tree.create(filePath, content);
  }
  return tree;
}

// ─── updateAngularJsonBuilder ─────────────────────────────────────────────────

describe('ng-add schematic — updateAngularJsonBuilder', () => {
  it('updates builder to @ng-annotate/angular:dev-server', async () => {
    const tree = makeTree({ 'package.json': BASE_PKG, 'angular.json': ANGULAR_JSON });
    const result = await runSchematic(tree);
    const angular = JSON.parse(result.readText('angular.json')) as Record<string, unknown>;
    const projects = angular['projects'] as Record<string, Record<string, unknown>>;
    const serve = (projects['my-app']['architect'] as Record<string, Record<string, unknown>>)['serve'];
    expect((serve['builder'] as string)).toBe('@ng-annotate/angular:dev-server');
  });

  it('skips when already using ng-annotate builder', async () => {
    const withNgAnnotate = JSON.stringify({
      projects: {
        'my-app': {
          architect: {
            serve: {
              builder: '@ng-annotate/angular:dev-server',
              options: {},
            },
          },
        },
      },
    });
    const tree = makeTree({ 'package.json': BASE_PKG, 'angular.json': withNgAnnotate });
    const result = await runSchematic(tree);
    const angular = JSON.parse(result.readText('angular.json')) as Record<string, unknown>;
    const projects = angular['projects'] as Record<string, Record<string, unknown>>;
    const serve = (projects['my-app']['architect'] as Record<string, Record<string, unknown>>)['serve'];
    expect((serve['builder'] as string)).toBe('@ng-annotate/angular:dev-server');
  });

  it('warns but does not change unknown builders', async () => {
    const withCustomBuilder = JSON.stringify({
      projects: {
        'my-app': {
          architect: {
            serve: {
              builder: '@custom/builder:dev-server',
              options: {},
            },
          },
        },
      },
    });
    const tree = makeTree({ 'package.json': BASE_PKG, 'angular.json': withCustomBuilder });
    const result = await runSchematic(tree);
    const angular = JSON.parse(result.readText('angular.json')) as Record<string, unknown>;
    const projects = angular['projects'] as Record<string, Record<string, unknown>>;
    const serve = (projects['my-app']['architect'] as Record<string, Record<string, unknown>>)['serve'];
    // Should NOT overwrite a custom builder
    expect((serve['builder'] as string)).toBe('@custom/builder:dev-server');
  });

  it('does not create vite.config.ts (Angular CLI never loads it)', async () => {
    const tree = makeTree({ 'package.json': BASE_PKG, 'angular.json': ANGULAR_JSON });
    const result = await runSchematic(tree);
    expect(result.exists('vite.config.ts')).toBe(false);
  });

  it('does not create proxy.conf.json (builder handles WS internally)', async () => {
    const tree = makeTree({ 'package.json': BASE_PKG, 'angular.json': ANGULAR_JSON });
    const result = await runSchematic(tree);
    expect(result.exists('proxy.conf.json')).toBe(false);
  });
});

// ─── addProviders ─────────────────────────────────────────────────────────────

describe('ng-add schematic — addProviders', () => {
  it('adds import and provideNgAnnotate() to standard app.config.ts', async () => {
    const tree = makeTree({
      'package.json': BASE_PKG,
      'src/app/app.config.ts': `import { ApplicationConfig } from '@angular/core';\nimport { provideRouter } from '@angular/router';\n\nimport { routes } from './app.routes';\n\nexport const appConfig: ApplicationConfig = {\n  providers: [provideRouter(routes)],\n};\n`,
    });
    const result = await runSchematic(tree);
    const content = result.readText('src/app/app.config.ts');
    expect(content).toContain("import { provideNgAnnotate } from '@ng-annotate/angular'");
    expect(content).toContain('provideNgAnnotate()');
  });

  it('handles multi-line imports without breaking them', async () => {
    const tree = makeTree({
      'package.json': BASE_PKG,
      'src/app/app.config.ts': `import {\n  ApplicationConfig,\n  provideZoneChangeDetection,\n} from '@angular/core';\nimport { provideRouter } from '@angular/router';\n\nexport const appConfig: ApplicationConfig = {\n  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes)],\n};\n`,
    });
    const result = await runSchematic(tree);
    const content = result.readText('src/app/app.config.ts');
    // Import should not be inserted inside the multi-line import block
    expect(content).not.toMatch(/import \{\nimport/);
    expect(content).toContain("import { provideNgAnnotate } from '@ng-annotate/angular'");
    expect(content).toContain('provideNgAnnotate()');
  });

  it('skips when provideNgAnnotate already present', async () => {
    const original = `import { provideNgAnnotate } from '@ng-annotate/angular';\n\nexport const appConfig = {\n  providers: [provideNgAnnotate()],\n};\n`;
    const tree = makeTree({ 'package.json': BASE_PKG, 'src/app/app.config.ts': original });
    const result = await runSchematic(tree);
    expect(result.readText('src/app/app.config.ts')).toBe(original);
  });
});

// ─── addGitignore ─────────────────────────────────────────────────────────────

describe('ng-add schematic — addGitignore', () => {
  it('creates .gitignore with .ng-annotate/ when none exists', async () => {
    const tree = makeTree({ 'package.json': BASE_PKG });
    const result = await runSchematic(tree);
    expect(result.readText('.gitignore')).toContain('.ng-annotate/');
  });

  it('appends to existing .gitignore', async () => {
    const tree = makeTree({ 'package.json': BASE_PKG, '.gitignore': 'node_modules/\ndist/\n' });
    const result = await runSchematic(tree);
    const content = result.readText('.gitignore');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.ng-annotate/');
  });

  it('skips if .ng-annotate/ already in .gitignore', async () => {
    const original = 'node_modules/\n.ng-annotate/\n';
    const tree = makeTree({ 'package.json': BASE_PKG, '.gitignore': original });
    const result = await runSchematic(tree);
    expect(result.readText('.gitignore')).toBe(original);
  });
});
