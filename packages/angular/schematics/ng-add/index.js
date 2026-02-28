"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const schematics_1 = require("@angular-devkit/schematics");
const tasks_1 = require("@angular-devkit/schematics/tasks");
const MIN_ANGULAR_MAJOR = 21;
function checkAngularVersion() {
    return (tree) => {
        const pkgPath = 'package.json';
        if (!tree.exists(pkgPath))
            return;
        const pkg = JSON.parse(tree.read(pkgPath).toString('utf-8'));
        const version = (pkg['dependencies']?.['@angular/core'] ?? pkg['devDependencies']?.['@angular/core']) || '';
        const match = version.match(/(\d+)/);
        const major = match ? parseInt(match[1], 10) : 0;
        if (major > 0 && major < MIN_ANGULAR_MAJOR) {
            throw new schematics_1.SchematicsException(`@ng-annotate/angular requires Angular ${MIN_ANGULAR_MAJOR} or higher. ` +
                `Found: ${version}`);
        }
    };
}
function addVitePlugin() {
    return (tree, context) => {
        const candidates = ['vite.config.ts', 'vite.config.js', 'vite.config.mts'];
        const viteConfigPath = candidates.find((p) => tree.exists(p));
        if (!viteConfigPath) {
            const created = `import { defineConfig } from 'vite';\nimport { ngAnnotateMcp } from '@ng-annotate/vite-plugin';\n\nexport default defineConfig({\n  plugins: [...ngAnnotateMcp()],\n});\n`;
            tree.create('vite.config.ts', created);
            context.logger.info('✅ Created vite.config.ts with ngAnnotateMcp()');
            return;
        }
        let content = tree.read(viteConfigPath).toString('utf-8');
        if (content.includes('@ng-annotate/vite-plugin')) {
            context.logger.info('@ng-annotate/vite-plugin vite plugin already present, skipping.');
            return;
        }
        // Insert import after the last existing import line
        content = content.replace(/(^import .+$(\r?\n)?)+/m, (match) => match + "import { ngAnnotateMcp } from '@ng-annotate/vite-plugin';\n");
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
function addMcpConfig(options) {
    return (tree, context) => {
        const projectRoot = process.cwd().replace(/\\/g, '/');
        const env = { NG_ANNOTATE_PROJECT_ROOT: projectRoot };
        const isWindows = process.platform === 'win32';
        const { aiTool } = options;
        if (aiTool === 'other') {
            const claudeConfig = JSON.stringify({
                mcpServers: {
                    'ng-annotate': isWindows
                        ? { command: 'cmd', args: ['/c', 'npx', '-y', '@ng-annotate/mcp-server'], env }
                        : { command: 'npx', args: ['-y', '@ng-annotate/mcp-server'], env },
                },
            }, null, 2);
            const vscodeConfig = JSON.stringify({
                servers: {
                    'ng-annotate': {
                        type: 'stdio',
                        command: 'npx',
                        args: ['-y', '@ng-annotate/mcp-server'],
                        env,
                    },
                },
            }, null, 2);
            context.logger.info('\n⚙️  Manual MCP configuration:\n\n' +
                'For Claude Code (.mcp.json):\n' +
                claudeConfig +
                '\n\n' +
                'For VS Code Copilot (.vscode/mcp.json):\n' +
                vscodeConfig +
                '\n');
            return;
        }
        // .mcp.json — Claude Code (needs cmd /c on Windows to invoke npx.cmd)
        if (aiTool === 'claude-code' || aiTool === 'both') {
            if (!tree.exists('.mcp.json')) {
                const mcpConfig = {
                    mcpServers: {
                        'ng-annotate': isWindows
                            ? { command: 'cmd', args: ['/c', 'npx', '-y', '@ng-annotate/mcp-server'], env }
                            : { command: 'npx', args: ['-y', '@ng-annotate/mcp-server'], env },
                    },
                };
                tree.create('.mcp.json', JSON.stringify(mcpConfig, null, 2) + '\n');
                context.logger.info('✅ Created .mcp.json');
            }
            else {
                context.logger.info('.mcp.json already exists, skipping.');
            }
        }
        // .vscode/mcp.json — VS Code Copilot
        if (aiTool === 'vscode' || aiTool === 'both') {
            const vscodeMcpPath = '.vscode/mcp.json';
            if (!tree.exists(vscodeMcpPath)) {
                const vscodeMcpConfig = {
                    servers: {
                        'ng-annotate': {
                            type: 'stdio',
                            command: 'npx',
                            args: ['-y', '@ng-annotate/mcp-server'],
                            env,
                        },
                    },
                };
                tree.create(vscodeMcpPath, JSON.stringify(vscodeMcpConfig, null, 2) + '\n');
                context.logger.info('✅ Created .vscode/mcp.json');
            }
            else {
                context.logger.info('.vscode/mcp.json already exists, skipping.');
            }
        }
    };
}
function addDevDependency() {
    return (tree, context) => {
        const pkgPath = 'package.json';
        if (!tree.exists(pkgPath))
            return;
        const pkg = JSON.parse(tree.read(pkgPath).toString('utf-8'));
        pkg['devDependencies'] ?? (pkg['devDependencies'] = {});
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
            context.addTask(new tasks_1.NodePackageInstallTask());
        }
    };
}
function default_1(options) {
    return (tree, context) => {
        context.logger.info('Setting up @ng-annotate...');
        return (0, schematics_1.chain)([
            checkAngularVersion(),
            addDevDependency(),
            addVitePlugin(),
            addProviders(),
            addMcpConfig(options),
        ])(tree, context);
    };
}
