import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';

function log(msg: string): void {
  process.stderr.write(`[ng-annotate-mcp] ${msg}\n`);
}

async function main(): Promise<void> {
  log(`starting up (cwd: ${process.cwd()}, node: ${process.version})`);

  const server = new McpServer({
    name: 'ng-annotate',
    version: '0.1.0',
    description:
      'Connects an AI agent to a live Angular dev session for annotation-driven code changes',
  });

  log('registering tools...');
  registerTools(server);

  log('connecting stdio transport...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('connected — ready for requests');
}

main().catch((err: unknown) => {
  process.stderr.write(`[ng-annotate-mcp] fatal error: ${String(err)}\n`);
  process.exit(1);
});
