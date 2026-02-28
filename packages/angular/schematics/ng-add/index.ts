import { Rule, SchematicContext, Tree, chain, SchematicsException } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

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
      context.logger.warn(
        '⚠️  Could not find vite.config.ts — add the plugin manually:\n' +
          "    import { ngAnnotateMcp } from '@ng-annotate/vite-plugin';\n" +
          '    plugins: [...ngAnnotateMcp()]',
      );
      return;
    }

    let content = tree.read(viteConfigPath)!.toString('utf-8');

    if (content.includes('@ng-annotate/vite-plugin')) {
      context.logger.info('@ng-annotate/vite-plugin vite plugin already present, skipping.');
      return;
    }

    // Insert import after the last existing import line
    content = content.replace(
      /(^import .+$(\r?\n)?)+/m,
      (match) => match + "import { ngAnnotateMcp } from '@ng-annotate/vite-plugin';\n",
    );

    // Insert spread into plugins array (handles `plugins: [` or `plugins:[`)
    content = content.replace(/plugins\s*:\s*\[/, 'plugins: [...ngAnnotateMcp(), ');

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

    // Insert import after the last existing import line
    content = content.replace(
      /(^import .+$(\r?\n)?)+/m,
      (match) => match + "import { provideNgAnnotate } from '@ng-annotate/angular';\n",
    );

    // Insert into providers array
    content = content.replace(/providers\s*:\s*\[/, 'providers: [\n    provideNgAnnotate(),');

    tree.overwrite(appConfigPath, content);
    context.logger.info(`✅ Added provideNgAnnotate() to ${appConfigPath}`);
  };
}

function addMcpConfig(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    // .mcp.json — Claude Code (needs cmd /c on Windows to spawn npx.cmd)
    if (!tree.exists('.mcp.json')) {
      const isWindows = process.platform === 'win32';
      const mcpConfig = {
        mcpServers: {
          'ng-annotate': isWindows
            ? { command: 'cmd', args: ['/c', 'npx', '@ng-annotate/mcp-server'] }
            : { command: 'npx', args: ['@ng-annotate/mcp-server'] },
        },
      };
      tree.create('.mcp.json', JSON.stringify(mcpConfig, null, 2) + '\n');
      context.logger.info('✅ Created .mcp.json');
    } else {
      context.logger.info('.mcp.json already exists, skipping.');
    }

    // .vscode/mcp.json — VS Code Copilot (spawns npx.cmd natively on Windows)
    const vscodeMcpPath = '.vscode/mcp.json';
    if (!tree.exists(vscodeMcpPath)) {
      const vscodeMcpConfig = {
        servers: {
          'ng-annotate': {
            type: 'stdio',
            command: 'npx',
            args: ['@ng-annotate/mcp-server'],
          },
        },
      };
      tree.create(vscodeMcpPath, JSON.stringify(vscodeMcpConfig, null, 2) + '\n');
      context.logger.info('✅ Created .vscode/mcp.json');
    } else {
      context.logger.info('.vscode/mcp.json already exists, skipping.');
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

export default function (): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info('Setting up @ng-annotate/vite-plugin...');
    return chain([checkAngularVersion(), addDevDependency(), addVitePlugin(), addProviders(), addMcpConfig()])(
      tree,
      context,
    );
  };
}
