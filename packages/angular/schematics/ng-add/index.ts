import { Rule, SchematicContext, Tree, chain, SchematicsException } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import * as fs from 'fs';
import * as path from 'path';

/** Insert `newImport` on the line after the last import statement (handles multi-line imports and blank lines between groups). */
function insertAfterLastImport(content: string, newImport: string): string {
  const lines = content.split('\n');
  let lastImportLine = -1;
  let inImport = false;

  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) inImport = true;
    if (inImport) {
      lastImportLine = i;
      if (lines[i].includes(';')) inImport = false;
    }
  }

  if (lastImportLine < 0) return newImport + '\n' + content;
  lines.splice(lastImportLine + 1, 0, newImport);
  return lines.join('\n');
}

/** Insert `newProvider` as the first item in the `providers: [...]` array, preserving indentation style. */
function insertIntoProviders(content: string, newProvider: string): string {
  return content.replace(/^(\s*)providers\s*:\s*\[/m, (match, indent) => {
    return `${indent}providers: [\n${indent}  ${newProvider},`;
  });
}

interface Options {
  aiTool: 'claude-code' | 'vscode' | 'both' | 'other';
}

const MIN_ANGULAR_MAJOR = 21;

function checkAngularVersion(): Rule {
  return (tree: Tree) => {
    const pkgPath = 'package.json';
    if (!tree.exists(pkgPath)) return;

    const pkg = JSON.parse(tree.read(pkgPath)!.toString('utf-8')) as Record<
      string,
      Record<string, string>
    >;
    const version: string =
      (pkg['dependencies']?.['@angular/core'] ?? pkg['devDependencies']?.['@angular/core']) || '';
    const match = version.match(/(\d+)/);
    const major = match ? parseInt(match[1], 10) : 0;

    if (major > 0 && major < MIN_ANGULAR_MAJOR) {
      throw new SchematicsException(
        `@ng-annotate/angular requires Angular ${MIN_ANGULAR_MAJOR} or higher. ` +
          `Found: ${version}`,
      );
    }
  };
}

function addVitePlugin(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const candidates = ['vite.config.ts', 'vite.config.js', 'vite.config.mts'];
    const viteConfigPath = candidates.find((p) => tree.exists(p));

    if (!viteConfigPath) {
      const created = `import { defineConfig } from 'vite';\nimport { ngAnnotateMcp } from '@ng-annotate/vite-plugin';\n\nexport default defineConfig({\n  plugins: [...ngAnnotateMcp()],\n});\n`;
      tree.create('vite.config.ts', created);
      context.logger.info('✅ Created vite.config.ts with ngAnnotateMcp()');
      return;
    }

    let content = tree.read(viteConfigPath)!.toString('utf-8');

    if (content.includes('@ng-annotate/vite-plugin')) {
      context.logger.info('@ng-annotate/vite-plugin vite plugin already present, skipping.');
      return;
    }

    content = insertAfterLastImport(content, "import { ngAnnotateMcp } from '@ng-annotate/vite-plugin';");

    if (/plugins\s*:\s*\[/.test(content)) {
      // Existing plugins array — prepend into it
      content = content.replace(/plugins\s*:\s*\[/, 'plugins: [...ngAnnotateMcp(), ');
    } else {
      // No plugins array — inject one into defineConfig({...})
      content = content.replace(/defineConfig\(\s*\{/, 'defineConfig({\n  plugins: [...ngAnnotateMcp()],');
    }

    tree.overwrite(viteConfigPath, content);
    context.logger.info(`✅ Added ngAnnotateMcp() to ${viteConfigPath}`);
  };
}

function addProviders(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const candidates = [
      'src/app/app.config.ts',
      'src/app.config.ts',
      'app/app.config.ts',
    ];
    const appConfigPath = candidates.find((p) => tree.exists(p));

    if (!appConfigPath) {
      context.logger.warn(
        '⚠️  Could not find app.config.ts — add provideNgAnnotate() manually:\n' +
          "    import { provideNgAnnotate } from '@ng-annotate/angular';\n" +
          '    providers: [provideNgAnnotate()]',
      );
      return;
    }

    let content = tree.read(appConfigPath)!.toString('utf-8');

    if (content.includes('provideNgAnnotate')) {
      context.logger.info('provideNgAnnotate already present, skipping.');
      return;
    }

    content = insertAfterLastImport(content, "import { provideNgAnnotate } from '@ng-annotate/angular';");
    content = insertIntoProviders(content, 'provideNgAnnotate()');

    tree.overwrite(appConfigPath, content);
    context.logger.info(`✅ Added provideNgAnnotate() to ${appConfigPath}`);
  };
}

/** Walk up from startDir until we find a .git folder; returns that directory or null. */
function findGitRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Write a config file outside the schematic Tree (e.g. to a parent git root).
 * Uses fs directly — intentionally bypasses Tree so it works for out-of-project paths.
 */
function writeOutsideTree(absPath: string, content: string, context: SchematicContext): void {
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(absPath)) {
    context.logger.info(`${path.basename(absPath)} already exists at workspace root, skipping.`);
    return;
  }
  fs.writeFileSync(absPath, content, 'utf-8');
  context.logger.info(`✅ Created ${path.basename(absPath)} at workspace root (${dir})`);
}

function addMcpConfig(options: Options): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const projectRoot = process.cwd();
    const env = { NG_ANNOTATE_PROJECT_ROOT: projectRoot.replace(/\\/g, '/') };
    const isWindows = process.platform === 'win32';
    const { aiTool } = options;

    // Detect monorepo: if git root is a parent of the Angular project, VS Code is likely
    // opened there — write configs to both the project folder and the git root.
    const gitRoot = findGitRoot(projectRoot);
    const isSubproject =
      gitRoot !== null && path.resolve(gitRoot) !== path.resolve(projectRoot);

    if (aiTool === 'other') {
      const claudeConfig = JSON.stringify(
        {
          mcpServers: {
            'ng-annotate': isWindows
              ? { command: 'cmd', args: ['/c', 'npx', '-y', '@ng-annotate/mcp-server'], env }
              : { command: 'npx', args: ['-y', '@ng-annotate/mcp-server'], env },
          },
        },
        null,
        2,
      );
      const vscodeConfig = JSON.stringify(
        {
          servers: {
            'ng-annotate': {
              type: 'stdio',
              command: 'npx',
              args: ['-y', '@ng-annotate/mcp-server'],
              env,
            },
          },
        },
        null,
        2,
      );
      context.logger.info(
        '\n⚙️  Manual MCP configuration:\n\n' +
          'For Claude Code (.mcp.json):\n' +
          claudeConfig +
          '\n\n' +
          'For VS Code Copilot (.vscode/mcp.json):\n' +
          vscodeConfig +
          '\n',
      );
      return;
    }

    // .mcp.json — Claude Code (needs cmd /c on Windows to invoke npx.cmd)
    if (aiTool === 'claude-code' || aiTool === 'both') {
      const mcpConfig =
        JSON.stringify(
          {
            mcpServers: {
              'ng-annotate': isWindows
                ? { command: 'cmd', args: ['/c', 'npx', '-y', '@ng-annotate/mcp-server'], env }
                : { command: 'npx', args: ['-y', '@ng-annotate/mcp-server'], env },
            },
          },
          null,
          2,
        ) + '\n';

      if (!tree.exists('.mcp.json')) {
        tree.create('.mcp.json', mcpConfig);
        context.logger.info('✅ Created .mcp.json');
      } else {
        context.logger.info('.mcp.json already exists, skipping.');
      }

      if (isSubproject) {
        writeOutsideTree(path.join(gitRoot!, '.mcp.json'), mcpConfig, context);
      }
    }

    // .vscode/mcp.json — VS Code Copilot
    if (aiTool === 'vscode' || aiTool === 'both') {
      const vscodeMcpConfig =
        JSON.stringify(
          {
            servers: {
              'ng-annotate': {
                type: 'stdio',
                command: 'npx',
                args: ['-y', '@ng-annotate/mcp-server'],
                env,
              },
            },
          },
          null,
          2,
        ) + '\n';

      const vscodeMcpPath = '.vscode/mcp.json';
      if (!tree.exists(vscodeMcpPath)) {
        tree.create(vscodeMcpPath, vscodeMcpConfig);
        context.logger.info('✅ Created .vscode/mcp.json');
      } else {
        context.logger.info('.vscode/mcp.json already exists, skipping.');
      }

      if (isSubproject) {
        writeOutsideTree(path.join(gitRoot!, '.vscode', 'mcp.json'), vscodeMcpConfig, context);
      }
    }
  };
}

function addDevDependency(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const pkgPath = 'package.json';
    if (!tree.exists(pkgPath)) return;

    const pkg = JSON.parse(tree.read(pkgPath)!.toString('utf-8')) as Record<
      string,
      Record<string, string>
    >;
    pkg['devDependencies'] ??= {};

    let changed = false;

    if (!pkg['devDependencies']['@ng-annotate/vite-plugin']) {
      pkg['devDependencies']['@ng-annotate/vite-plugin'] = 'latest';
      changed = true;
      context.logger.info('✅ Added @ng-annotate/vite-plugin to devDependencies');
    }

    if (!pkg['devDependencies']['@ng-annotate/mcp-server']) {
      pkg['devDependencies']['@ng-annotate/mcp-server'] = 'latest';
      changed = true;
      context.logger.info('✅ Added @ng-annotate/mcp-server to devDependencies');
    }

    if (changed) {
      tree.overwrite(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      context.addTask(new NodePackageInstallTask());
    }
  };
}

function addGitignore(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const entry = '.ng-annotate/';
    const gitignorePath = '.gitignore';

    if (!tree.exists(gitignorePath)) {
      tree.create(gitignorePath, entry + '\n');
      context.logger.info('✅ Created .gitignore with .ng-annotate/');
      return;
    }

    const content = tree.read(gitignorePath)!.toString('utf-8');
    if (content.includes(entry)) {
      context.logger.info('.ng-annotate/ already in .gitignore, skipping.');
      return;
    }

    tree.overwrite(gitignorePath, content.trimEnd() + '\n\n' + entry + '\n');
    context.logger.info('✅ Added .ng-annotate/ to .gitignore');
  };
}

export default function (options: Options): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info('Setting up @ng-annotate...');
    return chain([
      checkAngularVersion(),
      addDevDependency(),
      addVitePlugin(),
      addProviders(),
      addMcpConfig(options),
      addGitignore(),
    ])(tree, context);
  };
}
