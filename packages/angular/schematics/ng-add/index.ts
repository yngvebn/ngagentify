import { Rule, SchematicContext, Tree, chain, SchematicsException } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import * as fs from 'fs';
import * as path from 'path';
import { insertAfterLastImport, insertIntoProviders } from './helpers';

interface Options {
  aiTool: 'claude-code' | 'vscode' | 'both' | 'other';
}

const MIN_ANGULAR_MAJOR = 21;
const NG_ANNOTATE_BUILDER = '@ng-annotate/angular:dev-server';

// Both builders use the same underlying implementation in Angular 17+.
// @angular-devkit/build-angular:dev-server is the legacy alias that many
// projects still have in their angular.json even on Angular 21.
const COMPATIBLE_DEV_SERVER_BUILDERS = [
  '@angular/build:dev-server',
  '@angular-devkit/build-angular:dev-server',
];

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

function updateAngularJsonBuilder(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const angularJsonPath = 'angular.json';
    if (!tree.exists(angularJsonPath)) {
      context.logger.warn(
        '⚠️  Could not find angular.json — update the serve builder manually:\n' +
          `    "builder": "${NG_ANNOTATE_BUILDER}"`,
      );
      return;
    }

    const angularJson = JSON.parse(tree.read(angularJsonPath)!.toString('utf-8')) as Record<
      string,
      unknown
    >;
    const projects = angularJson['projects'] as Record<string, unknown> | undefined;
    if (!projects) return;

    let changed = false;
    for (const projectName of Object.keys(projects)) {
      const project = projects[projectName] as Record<string, unknown>;
      const architect = project['architect'] as Record<string, unknown> | undefined;
      if (!architect) continue;

      const serve = architect['serve'] as Record<string, unknown> | undefined;
      if (!serve) continue;

      const currentBuilder = serve['builder'] as string | undefined;

      if (currentBuilder === NG_ANNOTATE_BUILDER) {
        context.logger.info(`ng-annotate builder already configured in ${projectName}, skipping.`);
        continue;
      }

      if (!COMPATIBLE_DEV_SERVER_BUILDERS.includes(currentBuilder ?? '')) {
        context.logger.warn(
          `⚠️  Project "${projectName}" uses builder "${String(currentBuilder)}" which is not ` +
            `a compatible dev-server builder. Skipping automatic builder update — ` +
            `set it to "${NG_ANNOTATE_BUILDER}" manually if compatible.`,
        );
        continue;
      }

      serve['builder'] = NG_ANNOTATE_BUILDER;
      changed = true;
      context.logger.info(`✅ Updated angular.json serve builder for "${projectName}"`);
    }

    if (changed) {
      tree.overwrite(angularJsonPath, JSON.stringify(angularJson, null, 2) + '\n');
    }
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
    const isWindows = process.platform === 'win32';
    const { aiTool } = options;

    // Detect monorepo: if git root is a parent of the Angular project, VS Code is likely
    // opened there — write configs to both the project folder and the git root.
    const gitRoot = findGitRoot(projectRoot);
    const isSubproject =
      gitRoot !== null && path.resolve(gitRoot) !== path.resolve(projectRoot);

    // NG_ANNOTATE_PROJECT_ROOT must point to the git root (= store location),
    // not the Angular project subdir. The builder also walks up to .git when
    // writing the store, so both sides must agree on this directory.
    const storeRoot = gitRoot ?? projectRoot;
    const env = { NG_ANNOTATE_PROJECT_ROOT: storeRoot.replace(/\\/g, '/') };

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
    pkg['dependencies'] ??= {};
    pkg['devDependencies'] ??= {};

    let changed = false;

    // ng add installs @ng-annotate/angular into dependencies by default.
    // Move it to devDependencies — it is a dev-only tool.
    const ngAnnotateVersion = pkg['dependencies']['@ng-annotate/angular'];
    if (ngAnnotateVersion && !pkg['devDependencies']['@ng-annotate/angular']) {
      pkg['devDependencies']['@ng-annotate/angular'] = ngAnnotateVersion;
      delete pkg['dependencies']['@ng-annotate/angular'];
      changed = true;
      context.logger.info('✅ Moved @ng-annotate/angular to devDependencies');
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

/** Append a gitignore entry to a file on the real filesystem (outside the schematic Tree). */
function addEntryToGitignoreOutsideTree(
  absPath: string,
  entry: string,
  context: SchematicContext,
): void {
  try {
    if (fs.existsSync(absPath)) {
      const content = fs.readFileSync(absPath, 'utf-8');
      if (content.includes(entry)) {
        context.logger.info(`${entry} already in root .gitignore, skipping.`);
        return;
      }
      fs.writeFileSync(absPath, content.trimEnd() + '\n\n' + entry + '\n', 'utf-8');
      context.logger.info(`✅ Added ${entry} to root .gitignore (${absPath})`);
    } else {
      fs.writeFileSync(absPath, entry + '\n', 'utf-8');
      context.logger.info(`✅ Created .gitignore with ${entry} at repository root (${absPath})`);
    }
  } catch (err) {
    context.logger.warn(`⚠️  Could not update root .gitignore at ${absPath}: ${String(err)}`);
  }
}

function addGitignore(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const entry = '.ng-annotate/';
    const projectRoot = process.cwd();
    const gitRoot = findGitRoot(projectRoot);
    const isSubproject =
      gitRoot !== null && path.resolve(gitRoot) !== path.resolve(projectRoot);

    context.logger.info(
      `ng-annotate gitignore: projectRoot=${projectRoot}, gitRoot=${gitRoot ?? 'none'}, isSubproject=${String(isSubproject)}`,
    );

    // Always update the Angular project's .gitignore via the Tree (supports --dry-run).
    const gitignorePath = '.gitignore';
    if (!tree.exists(gitignorePath)) {
      tree.create(gitignorePath, entry + '\n');
      context.logger.info('✅ Created .gitignore with .ng-annotate/');
    } else {
      const content = tree.read(gitignorePath)!.toString('utf-8');
      if (content.includes(entry)) {
        context.logger.info('.ng-annotate/ already in .gitignore, skipping.');
      } else {
        tree.overwrite(gitignorePath, content.trimEnd() + '\n\n' + entry + '\n');
        context.logger.info('✅ Added .ng-annotate/ to .gitignore');
      }
    }

    // For monorepos: the store lives at the git root, so also add the entry there.
    if (isSubproject) {
      addEntryToGitignoreOutsideTree(path.join(gitRoot!, '.gitignore'), entry, context);
    }
  };
}

export default function (options: Options): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info('Setting up @ng-annotate...');
    return chain([
      checkAngularVersion(),
      addDevDependency(),
      updateAngularJsonBuilder(),
      addProviders(),
      addMcpConfig(options),
      addGitignore(),
    ])(tree, context);
  };
}
