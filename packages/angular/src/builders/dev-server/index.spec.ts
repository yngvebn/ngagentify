import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { makeLogger, findStoreRoot, findTsConfig, buildManifest } from './index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ng-annotate-test-'));
}

function writeTsConfig(dir: string, files: string[]): string {
  const tsConfigPath = path.join(dir, 'tsconfig.json');
  fs.writeFileSync(tsConfigPath, JSON.stringify({
    compilerOptions: {},
    files: files.map(f => path.relative(dir, f)),
  }));
  return tsConfigPath;
}

const noopLog = makeLogger(false);

// ─── makeLogger ───────────────────────────────────────────────────────────────

describe('makeLogger', () => {
  let stderrSpy: MockInstance;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('always writes info messages regardless of debug flag', () => {
    makeLogger(false).info('hello');
    expect(stderrSpy).toHaveBeenCalledWith('[ng-annotate] hello\n');
  });

  it('does not write debug messages when debug=false', () => {
    makeLogger(false).debug('secret');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('writes debug messages when debug=true', () => {
    makeLogger(true).debug('verbose');
    expect(stderrSpy).toHaveBeenCalledWith('[ng-annotate:debug] verbose\n');
  });

  it('prefixes info with [ng-annotate]', () => {
    makeLogger(true).info('msg');
    expect(stderrSpy).toHaveBeenCalledWith('[ng-annotate] msg\n');
  });

  it('prefixes debug with [ng-annotate:debug]', () => {
    makeLogger(true).debug('msg');
    expect(stderrSpy).toHaveBeenCalledWith('[ng-annotate:debug] msg\n');
  });
});

// ─── findStoreRoot ────────────────────────────────────────────────────────────

describe('findStoreRoot', () => {
  let root: string;

  beforeEach(() => { root = tmpDir(); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('returns startDir when no .git is found', () => {
    expect(findStoreRoot(root)).toBe(path.resolve(root));
  });

  it('returns the directory containing .git', () => {
    const sub = path.join(root, 'packages', 'app');
    fs.mkdirSync(sub, { recursive: true });
    fs.mkdirSync(path.join(root, '.git'));
    expect(findStoreRoot(sub)).toBe(root);
  });

  it('finds .git when nested several levels deep', () => {
    const deep = path.join(root, 'a', 'b', 'c');
    fs.mkdirSync(deep, { recursive: true });
    fs.mkdirSync(path.join(root, '.git'));
    expect(findStoreRoot(deep)).toBe(root);
  });

  it('returns startDir when .git exists in a sibling, not an ancestor', () => {
    const sibling = path.join(root, 'sibling');
    const target = path.join(root, 'target');
    fs.mkdirSync(path.join(sibling, '.git'), { recursive: true });
    fs.mkdirSync(target);
    // target has no .git ancestor — should return target (resolved)
    expect(findStoreRoot(target)).toBe(path.resolve(target));
  });
});

// ─── findTsConfig ─────────────────────────────────────────────────────────────

describe('findTsConfig', () => {
  let root: string;

  beforeEach(() => { root = tmpDir(); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('reads tsConfig path from angular.json for the named project', () => {
    fs.writeFileSync(path.join(root, 'angular.json'), JSON.stringify({
      projects: { myApp: { architect: { build: { options: { tsConfig: 'tsconfig.app.json' } } } } },
    }));
    fs.writeFileSync(path.join(root, 'tsconfig.app.json'), '{}');
    expect(findTsConfig(root, 'myApp', noopLog)).toBe(path.join(root, 'tsconfig.app.json'));
  });

  it('falls back to tsconfig.app.json when angular.json is absent', () => {
    fs.writeFileSync(path.join(root, 'tsconfig.app.json'), '{}');
    expect(findTsConfig(root, undefined, noopLog)).toBe(path.join(root, 'tsconfig.app.json'));
  });

  it('falls back to tsconfig.json when tsconfig.app.json is absent', () => {
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}');
    expect(findTsConfig(root, undefined, noopLog)).toBe(path.join(root, 'tsconfig.json'));
  });

  it('prefers tsconfig.app.json over tsconfig.json in fallback chain', () => {
    fs.writeFileSync(path.join(root, 'tsconfig.app.json'), '{}');
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}');
    expect(findTsConfig(root, undefined, noopLog)).toBe(path.join(root, 'tsconfig.app.json'));
  });

  it('returns undefined when no tsconfig candidate exists', () => {
    expect(findTsConfig(root, undefined, noopLog)).toBeUndefined();
  });

  it('returns undefined when projectName is not in angular.json and no fallback exists', () => {
    fs.writeFileSync(path.join(root, 'angular.json'), JSON.stringify({ projects: {} }));
    expect(findTsConfig(root, 'nonexistent', noopLog)).toBeUndefined();
  });

  it('falls back when angular.json does not have tsConfig for the project', () => {
    fs.writeFileSync(path.join(root, 'angular.json'), JSON.stringify({
      projects: { myApp: { architect: { build: { options: {} } } } },
    }));
    fs.writeFileSync(path.join(root, 'tsconfig.app.json'), '{}');
    expect(findTsConfig(root, 'myApp', noopLog)).toBe(path.join(root, 'tsconfig.app.json'));
  });

  it('resolves tsConfig relative to workspaceRoot', () => {
    fs.mkdirSync(path.join(root, 'projects', 'app'), { recursive: true });
    fs.writeFileSync(path.join(root, 'projects', 'app', 'tsconfig.app.json'), '{}');
    fs.writeFileSync(path.join(root, 'angular.json'), JSON.stringify({
      projects: { myApp: { architect: { build: { options: { tsConfig: 'projects/app/tsconfig.app.json' } } } } },
    }));
    expect(findTsConfig(root, 'myApp', noopLog)).toBe(
      path.join(root, 'projects', 'app', 'tsconfig.app.json'),
    );
  });
});

// ─── buildManifest ────────────────────────────────────────────────────────────

describe('buildManifest', () => {
  let root: string;

  beforeEach(() => { root = tmpDir(); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('finds a component and adds it to the manifest', () => {
    const compFile = path.join(root, 'app.component.ts');
    fs.writeFileSync(compFile, `@Component({ template: '<div>hi</div>' })\nexport class AppComponent {}`);
    const tsConfig = writeTsConfig(root, [compFile]);

    const manifest = buildManifest(tsConfig, root, noopLog);
    expect(manifest.AppComponent).toBeDefined();
    expect(manifest.AppComponent.component).toBe('app.component.ts');
    expect(manifest.AppComponent.template).toBeUndefined();
  });

  it('resolves templateUrl relative to the component file', () => {
    const compFile = path.join(root, 'app.component.ts');
    fs.writeFileSync(compFile, `@Component({ templateUrl: './app.component.html' })\nexport class AppComponent {}`);
    const tsConfig = writeTsConfig(root, [compFile]);

    const manifest = buildManifest(tsConfig, root, noopLog);
    expect(manifest.AppComponent.template).toBe('app.component.html');
  });

  it('resolves templateUrl in a subdirectory', () => {
    const dir = path.join(root, 'src', 'app', 'header');
    fs.mkdirSync(dir, { recursive: true });
    const compFile = path.join(dir, 'header.component.ts');
    fs.writeFileSync(compFile, `@Component({ templateUrl: './header.component.html' })\nexport class HeaderComponent {}`);
    const tsConfig = writeTsConfig(root, [compFile]);

    const manifest = buildManifest(tsConfig, root, noopLog);
    expect(manifest.HeaderComponent.component).toBe('src/app/header/header.component.ts');
    expect(manifest.HeaderComponent.template).toBe('src/app/header/header.component.html');
  });

  it('ignores files without @Component', () => {
    const svcFile = path.join(root, 'app.service.ts');
    fs.writeFileSync(svcFile, `export class AppService { getValue() { return 42; } }`);
    const tsConfig = writeTsConfig(root, [svcFile]);

    expect(buildManifest(tsConfig, root, noopLog)).toEqual({});
  });

  it('ignores spec files even if tsconfig includes them', () => {
    const specFile = path.join(root, 'app.component.spec.ts');
    fs.writeFileSync(specFile, `@Component({ template: '' })\nexport class AppComponent {}`);
    const tsConfig = writeTsConfig(root, [specFile]);

    expect(buildManifest(tsConfig, root, noopLog)).toEqual({});
  });

  it('ignores .d.ts files', () => {
    const dtsFile = path.join(root, 'app.component.d.ts');
    fs.writeFileSync(dtsFile, `@Component({ template: '' })\nexport declare class AppComponent {}`);
    const tsConfig = writeTsConfig(root, [dtsFile]);

    expect(buildManifest(tsConfig, root, noopLog)).toEqual({});
  });

  it('handles multiple components in the same tsconfig', () => {
    const file1 = path.join(root, 'foo.component.ts');
    const file2 = path.join(root, 'bar.component.ts');
    fs.writeFileSync(file1, `@Component({ template: '' }) export class FooComponent {}`);
    fs.writeFileSync(file2, `@Component({ template: '' }) export class BarComponent {}`);
    const tsConfig = writeTsConfig(root, [file1, file2]);

    const manifest = buildManifest(tsConfig, root, noopLog);
    expect(Object.keys(manifest)).toHaveLength(2);
    expect(manifest.FooComponent).toBeDefined();
    expect(manifest.BarComponent).toBeDefined();
  });

  it('returns empty manifest when tsconfig has no files', () => {
    const tsConfig = writeTsConfig(root, []);
    expect(buildManifest(tsConfig, root, noopLog)).toEqual({});
  });

  it('returns empty manifest when tsconfig JSON is invalid', () => {
    const tsConfig = path.join(root, 'tsconfig.json');
    fs.writeFileSync(tsConfig, '{ invalid json :::');
    expect(buildManifest(tsConfig, root, noopLog)).toEqual({});
  });

  it('uses forward slashes in paths regardless of OS', () => {
    const dir = path.join(root, 'src', 'app');
    fs.mkdirSync(dir, { recursive: true });
    const compFile = path.join(dir, 'app.component.ts');
    fs.writeFileSync(compFile, `@Component({ template: '' })\nexport class AppComponent {}`);
    const tsConfig = writeTsConfig(root, [compFile]);

    const manifest = buildManifest(tsConfig, root, noopLog);
    expect(manifest.AppComponent.component).not.toContain('\\');
  });
});
