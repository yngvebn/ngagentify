"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const schematics_1 = require("@angular-devkit/schematics");
const tasks_1 = require("@angular-devkit/schematics/tasks");
function addVitePlugin() {
    return (tree, context) => {
        const candidates = ['vite.config.ts', 'vite.config.js', 'vite.config.mts'];
        const viteConfigPath = candidates.find((p) => tree.exists(p));
        if (!viteConfigPath) {
            context.logger.warn('⚠️  Could not find vite.config.ts — add the plugin manually:\n' +
                "    import { ngAnnotateMcp } from 'ng-annotate-mcp';\n" +
                '    plugins: [...ngAnnotateMcp()]');
            return;
        }
        let content = tree.read(viteConfigPath).toString('utf-8');
        if (content.includes('ng-annotate-mcp')) {
            context.logger.info('ng-annotate-mcp vite plugin already present, skipping.');
            return;
        }
        // Insert import after the last existing import line
        content = content.replace(/(^import .+$(\r?\n)?)+/m, (match) => match + "import { ngAnnotateMcp } from 'ng-annotate-mcp';\n");
        // Insert spread into plugins array (handles `plugins: [` or `plugins:[`)
        content = content.replace(/plugins\s*:\s*\[/, 'plugins: [...ngAnnotateMcp(), ');
        tree.overwrite(viteConfigPath, content);
        context.logger.info(`✅ Added ngAnnotateMcp() to ${viteConfigPath}`);
    };
}
function addProviders() {
    return (tree, context) => {
        const candidates = [
            'src/app/app.config.ts',
            'src/app.config.ts',
            'app/app.config.ts',
        ];
        const appConfigPath = candidates.find((p) => tree.exists(p));
        if (!appConfigPath) {
            context.logger.warn('⚠️  Could not find app.config.ts — add provideNgAnnotate() manually:\n' +
                "    import { provideNgAnnotate } from '@ng-annotate/angular';\n" +
                '    providers: [provideNgAnnotate()]');
            return;
        }
        let content = tree.read(appConfigPath).toString('utf-8');
        if (content.includes('provideNgAnnotate')) {
            context.logger.info('provideNgAnnotate already present, skipping.');
            return;
        }
        // Insert import after the last existing import line
        content = content.replace(/(^import .+$(\r?\n)?)+/m, (match) => match + "import { provideNgAnnotate } from '@ng-annotate/angular';\n");
        // Insert into providers array
        content = content.replace(/providers\s*:\s*\[/, 'providers: [\n    provideNgAnnotate(),');
        tree.overwrite(appConfigPath, content);
        context.logger.info(`✅ Added provideNgAnnotate() to ${appConfigPath}`);
    };
}
function addMcpConfig() {
    return (tree, context) => {
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
function addDevDependency() {
    return (tree, context) => {
        const pkgPath = 'package.json';
        if (!tree.exists(pkgPath))
            return;
        const pkg = JSON.parse(tree.read(pkgPath).toString('utf-8'));
        pkg['devDependencies'] ?? (pkg['devDependencies'] = {});
        if (!pkg['devDependencies']['ng-annotate-mcp']) {
            pkg['devDependencies']['ng-annotate-mcp'] = 'latest';
            tree.overwrite(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
            context.addTask(new tasks_1.NodePackageInstallTask());
            context.logger.info('✅ Added ng-annotate-mcp to devDependencies');
        }
    };
}
function default_1() {
    return (tree, context) => {
        context.logger.info('Setting up ng-annotate-mcp...');
        return (0, schematics_1.chain)([addDevDependency(), addVitePlugin(), addProviders(), addMcpConfig()])(tree, context);
    };
}
