import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'ng-annotate',
    version: '0.1.0',
    description:
      'Connects an AI agent to a live Angular dev session for annotation-driven code changes',
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
