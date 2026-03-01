import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { store, STORE_PATH } from './store.js';
import type { Annotation } from './store.js';

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

// ─── Work loop prompt ─────────────────────────────────────────────────────────

const WORK_LOOP_PROMPT = `\
Start the ng-annotate annotation work loop. Follow these steps continuously until told to stop.

## Startup
1. Call \`get_all_pending\` to drain any annotations that arrived before you connected.
2. Process each pending annotation (see Processing below).

## Watch loop
3. Call \`watch_annotations\` (default timeout).
4. If it returns \`{"status":"annotations",...}\`: process each annotation in the list.
5. If it returns \`{"status":"timeout"}\`: call \`watch_annotations\` again immediately.
6. After processing, return to step 3.

## Processing an annotation
1. Call \`acknowledge\` with the annotation ID — immediately, before reading any files.
2. Read \`componentFilePath\` and (if present) \`templateFilePath\` from the annotation data.
3. Understand the intent: \`annotationText\` is the instruction; \`selectionText\` is the highlighted target (prefer this as the primary focus when present).
4. Compute the changes you intend to make but DO NOT write to disk yet.
5. Build a unified diff of the proposed changes and call \`propose_diff\` with the annotation ID and diff string.
6. Call \`watch_diff_response\` with the annotation ID and wait for the developer to approve or reject.
   - If \`{"status":"approved"}\`: write the changes to disk, then call \`resolve\` with a one-sentence summary.
   - If \`{"status":"rejected"}\`: call \`reply\` asking what to change, or revise and call \`propose_diff\` again.
   - If \`{"status":"timeout"}\`: call \`reply\` letting the developer know you are still waiting.
7. If you need clarification before proposing: call \`reply\` with a question. Do NOT propose or resolve yet.
8. If the request is out of scope or not actionable: call \`dismiss\` with a reason.

## Rules
- Always \`acknowledge\` before touching any files.
- Never write files without a corresponding \`diff:approved\` response from the developer.
- Never \`resolve\` until the change is actually written to disk.
- Never modify files without a corresponding annotation.
`;

// ─── Tool and prompt registration ─────────────────────────────────────────────

export function registerTools(server: McpServer): void {
  // ── Prompt ────────────────────────────────────────────────────────────────

  server.registerPrompt(
    'start-polling',
    {
      description:
        'Start the ng-annotate annotation watch loop. Injects the full work loop instructions into the conversation.',
    },
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text: WORK_LOOP_PROMPT } }],
    }),
  );

  // ── Session tools ─────────────────────────────────────────────────────────

  server.registerTool(
    'list_sessions',
    { description: 'List all browser sessions connected to the dev server' },
    async () => {
      const sessions = await store.listSessions();
      return json(sessions);
    },
  );

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
    {
      description:
        'Startup step: get all pending annotations across all sessions, sorted oldest first. Call this on startup to drain annotations that arrived before the agent connected, then enter the watch_annotations loop.',
    },
    async () => {
      const annotations = await store.listAnnotations(undefined, 'pending');
      return json(annotations);
    },
  );

  // ── Action tools ──────────────────────────────────────────────────────────

  server.registerTool(
    'acknowledge',
    {
      description:
        "Acknowledge a pending annotation (pending → acknowledged). Call this IMMEDIATELY after receiving an annotation and BEFORE reading any files or starting edits. This signals to the browser that the agent is working on it.",
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
      description:
        'Mark an annotation as resolved. Call this ONLY after the file change has been successfully written to disk. Include a one-sentence summary of what was changed.',
      inputSchema: {
        id: z.string().describe('Annotation ID'),
        summary: z.string().optional().describe('One-sentence summary of what was changed'),
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
      description:
        'Dismiss an annotation as not actionable. Use when the request is out of scope, contradicts existing code, or cannot be safely implemented. A reason is required.',
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
      description:
        'Add an agent reply to an annotation thread without resolving it. Use to ask for clarification when the request is ambiguous. Do NOT call resolve until the user has responded.',
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

  // ── Diff preview tools ────────────────────────────────────────────────────

  server.registerTool(
    'propose_diff',
    {
      description:
        'Propose a unified diff for the developer to review before applying. Transitions the annotation to diff_proposed status. Call this after acknowledge, before writing any files. Then call watch_diff_response to wait for developer approval or rejection.',
      inputSchema: {
        id: z.string().describe('Annotation ID'),
        diff: z.string().describe('Unified diff string showing the proposed changes'),
      },
    },
    async ({ id, diff }) => {
      const annotation = await store.getAnnotation(id);
      if (!annotation) return error(`Annotation not found: ${id}`);

      const updated = await store.updateAnnotation(id, { status: 'diff_proposed', diff });
      if (!updated) return error(`Failed to update annotation: ${id}`);
      return json(updated);
    },
  );

  server.registerTool(
    'watch_diff_response',
    {
      description:
        'Wait for the developer to approve or reject a proposed diff. Long-polls until the developer responds or the timeout is reached. Returns {status:"approved"|"rejected",annotation} or {status:"timeout"}. Default timeout is 5 minutes.',
      inputSchema: {
        id: z.string().describe('Annotation ID'),
        timeoutMs: z
          .number()
          .optional()
          .describe('Timeout in milliseconds (default: 300000 = 5 minutes)'),
      },
    },
    async ({ id, timeoutMs }) => {
      const timeout = timeoutMs ?? 300_000;

      const existing = await store.getAnnotation(id);
      if (!existing) return error(`Annotation not found: ${id}`);
      if (existing.diffResponse) {
        return json({ status: existing.diffResponse, annotation: existing });
      }

      const result = await new Promise<
        | { status: 'approved' | 'rejected'; annotation: Annotation }
        | { status: 'timeout' }
      >((resolve) => {
        const interval = setInterval(() => {
          void (async () => {
            const annotation = await store.getAnnotation(id);
            if (annotation?.diffResponse) {
              clearInterval(interval);
              clearTimeout(timer);
              resolve({ status: annotation.diffResponse, annotation });
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

  // ── Watch tool ────────────────────────────────────────────────────────────

  server.registerTool(
    'watch_annotations',
    {
      description: `Long-poll for new pending annotations (polls every 500ms, default ${String(DEFAULT_WATCH_TIMEOUT_MS / 1000)}s timeout). Returns immediately if pending annotations already exist. This is the main event loop — call it again after processing annotations or on timeout, and keep calling it indefinitely. Result shape: {"status":"annotations","annotations":[...]} or {"status":"timeout"}.`,
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

      if (result.status === 'timeout') {
        const sessions = await store.listSessions();
        const activeSessions = sessions.filter((s) => s.active);
        return json({
          status: 'timeout',
          storePath: STORE_PATH,
          activeSessions: activeSessions.length,
          hint:
            activeSessions.length === 0
              ? 'No browser sessions connected. Open the app in the browser and make sure ng serve is running with the @ng-annotate/angular:dev-server builder.'
              : `${String(activeSessions.length)} browser session(s) connected. Press Alt+Shift+A in the browser to enter inspect mode, then click a component to annotate it. Call watch_annotations again to continue polling.`,
        });
      }

      return json(result);
    },
  );
}
