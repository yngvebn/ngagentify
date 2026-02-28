import { Rule, SchematicContext, Tree, chain } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

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
    if (tree.exists('.mcp.json')) {
      context.logger.info('.mcp.json already exists, skipping.');
      return;
    }

    const mcpConfig = {
      mcpServers: {
        'ng-annotate': {
          command: 'npx',
          args: ['-y', '@ng-annotate/mcp-server'],
        },
      },
    };

    tree.create('.mcp.json', JSON.stringify(mcpConfig, null, 2) + '\n');
    context.logger.info('✅ Created .mcp.json');
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

    if (!pkg['devDependencies']['@ng-annotate/vite-plugin']) {
      pkg['devDependencies']['@ng-annotate/vite-plugin'] = 'latest';
      tree.overwrite(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      context.addTask(new NodePackageInstallTask());
      context.logger.info('✅ Added @ng-annotate/vite-plugin to devDependencies');
    }
  };
}

export default function (): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info('Setting up @ng-annotate/vite-plugin...');
    return chain([addDevDependency(), addVitePlugin(), addProviders(), addMcpConfig()])(
      tree,
      context,
    );
  };
}
