import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { store } from '../../vite-plugin/src/store.js';
import type { Annotation } from '../../vite-plugin/src/store.js';

// ─── Response helpers ─────────────────────────────────────────────────────────

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function error(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WATCH_TIMEOUT_MS = 25_000;
const WATCH_POLL_INTERVAL_MS = 500;

// ─── Tool registration ────────────────────────────────────────────────────────

export function registerTools(server: McpServer): void {
  // ── Session tools ─────────────────────────────────────────────────────────

  server.registerTool('list_sessions', { description: 'List all browser sessions connected to the dev server' }, async () => {
    const sessions = await store.listSessions();
    return json(sessions);
  });

  server.registerTool(
    'get_session',
    {
      description: 'Get a session and all its annotations',
      inputSchema: { id: z.string().describe('Session ID') },
    },
    async ({ id }) => {
      const session = await store.getSession(id);
      if (!session) return error(`Session not found: ${id}`);
      const annotations = await store.listAnnotations(id);
      return json({ session, annotations });
    },
  );

  // ── Query tools ───────────────────────────────────────────────────────────

  server.registerTool(
    'get_pending',
    {
      description: 'Get all pending annotations for a specific session',
      inputSchema: { sessionId: z.string().describe('Session ID') },
    },
    async ({ sessionId }) => {
      const annotations = await store.listAnnotations(sessionId, 'pending');
      return json(annotations);
    },
  );

  server.registerTool(
    'get_all_pending',
    { description: 'Get all pending annotations across all sessions, sorted oldest first' },
    async () => {
      const annotations = await store.listAnnotations(undefined, 'pending');
      return json(annotations);
    },
  );

  // ── Action tools ──────────────────────────────────────────────────────────

  server.registerTool(
    'acknowledge',
    {
      description: 'Acknowledge a pending annotation and optionally add a message',
      inputSchema: {
        id: z.string().describe('Annotation ID'),
        message: z.string().optional().describe('Optional message to add as a reply'),
      },
    },
    async ({ id, message }) => {
      const annotation = await store.getAnnotation(id);
      if (!annotation) return error(`Annotation not found: ${id}`);
      if (annotation.status === 'acknowledged')
        return error(`Annotation ${id} is already acknowledged`);

      const updated = await store.updateAnnotation(id, { status: 'acknowledged' });
      if (!updated) return error(`Failed to update annotation: ${id}`);

      if (message) {
        await store.addReply(id, { author: 'agent', message });
      }
      return json(updated);
    },
  );

  server.registerTool(
    'resolve',
    {
      description: 'Mark an annotation as resolved',
      inputSchema: {
        id: z.string().describe('Annotation ID'),
        summary: z.string().optional().describe('Optional summary of what was changed'),
      },
    },
    async ({ id, summary }) => {
      const annotation = await store.getAnnotation(id);
      if (!annotation) return error(`Annotation not found: ${id}`);

      const updated = await store.updateAnnotation(id, { status: 'resolved' });
      if (!updated) return error(`Failed to update annotation: ${id}`);

      if (summary) {
        await store.addReply(id, { author: 'agent', message: summary });
      }
      return json(updated);
    },
  );

  server.registerTool(
    'dismiss',
    {
      description: 'Dismiss an annotation with a reason',
      inputSchema: {
        id: z.string().describe('Annotation ID'),
        reason: z.string().describe('Reason for dismissal (required)'),
      },
    },
    async ({ id, reason }) => {
      if (!reason) return error('Reason is required for dismissal');

      const annotation = await store.getAnnotation(id);
      if (!annotation) return error(`Annotation not found: ${id}`);

      const updated = await store.updateAnnotation(id, { status: 'dismissed' });
      if (!updated) return error(`Failed to update annotation: ${id}`);

      await store.addReply(id, { author: 'agent', message: reason });
      return json(updated);
    },
  );

  server.registerTool(
    'reply',
    {
      description: 'Add a reply to an annotation from the agent',
      inputSchema: {
        id: z.string().describe('Annotation ID'),
        message: z.string().describe('Reply message'),
      },
    },
    async ({ id, message }) => {
      const annotation = await store.getAnnotation(id);
      if (!annotation) return error(`Annotation not found: ${id}`);

      const updated = await store.addReply(id, { author: 'agent', message });
      if (!updated) return error(`Failed to add reply to annotation: ${id}`);
      return json(updated);
    },
  );

  // ── Watch tool ────────────────────────────────────────────────────────────

  server.registerTool(
    'watch_annotations',
    {
      description: `Wait for pending annotations, polling every 500ms. Returns immediately if pending annotations already exist.`,
      inputSchema: {
        sessionId: z.string().optional().describe('Optional session ID to filter by'),
        timeoutMs: z
          .number()
          .optional()
          .describe(`Timeout in milliseconds (default: ${String(DEFAULT_WATCH_TIMEOUT_MS)})`),
      },
    },
    async ({ sessionId, timeoutMs }) => {
      const timeout = timeoutMs ?? DEFAULT_WATCH_TIMEOUT_MS;

      // Check immediately first
      const existing = await store.listAnnotations(sessionId, 'pending');
      if (existing.length > 0) {
        return json({ status: 'annotations', annotations: existing });
      }

      // Poll for the duration of timeout
      const result = await new Promise<
        { status: 'annotations'; annotations: Annotation[] } | { status: 'timeout' }
      >((resolve) => {
        const interval = setInterval(() => {
          void (async () => {
            const pending = await store.listAnnotations(sessionId, 'pending');
            if (pending.length > 0) {
              clearInterval(interval);
              clearTimeout(timer);
              resolve({ status: 'annotations', annotations: pending });
            }
          })();
        }, WATCH_POLL_INTERVAL_MS);

        const timer = setTimeout(() => {
          clearInterval(interval);
          resolve({ status: 'timeout' });
        }, timeout);
      });

      return json(result);
    },
  );
}
