import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ── Mock McpServer ────────────────────────────────────────────────────────────

interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

class MockServer {
  private handlers = new Map<string, ToolHandler>();

  registerTool(name: string, _config: unknown, handler: ToolHandler) {
    this.handlers.set(name, handler);
  }

  registerPrompt(..._args: unknown[]) {
    // prompts are not exercised in unit tests
  }

  async call(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const handler = this.handlers.get(name);
    if (!handler) throw new Error(`Tool not found: ${name}`);
    return handler(args);
  }
}

function parseResult(result: ToolResult): unknown {
  return JSON.parse(result.content[0].text);
}

function isError(result: ToolResult): boolean {
  return result.isError === true;
}

// ── Test isolation ────────────────────────────────────────────────────────────

let tempDir: string;
let originalCwd: string;
let server: MockServer;
// store is dynamically imported via vi.resetModules() — typed as any intentionally
let store: any;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-tools-test-'));
  process.chdir(tempDir);
  vi.resetModules();

  // Import tools and store from the same fresh module graph
  const [toolsMod, storeMod] = await Promise.all([
    import('./tools.js'),
    import('../../vite-plugin/src/store.js'),
  ]);

  server = new MockServer();
  toolsMod.registerTools(server as unknown as McpServer);
  store = storeMod.store;
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAnnotationPayload(sessionId: string) {
  return {
    sessionId,
    componentName: 'TestComponent',
    componentFilePath: 'src/app/test.component.ts',
    selector: 'app-test',
    inputs: {},
    domSnapshot: '<app-test></app-test>',
    componentTreePath: ['AppComponent'],
    annotationText: 'Fix the bug',
  };
}

// ── list_sessions ─────────────────────────────────────────────────────────────

describe('list_sessions', () => {
  it('returns empty array when no sessions exist', async () => {
    const result = await server.call('list_sessions');
    expect(isError(result)).toBe(false);
    expect(parseResult(result)).toEqual([]);
  });

  it('returns all sessions after creating two', async () => {
    await store.createSession({ active: true, url: 'http://localhost:4200' });
    await store.createSession({ active: true, url: 'http://localhost:4200' });
    const result = await server.call('list_sessions');
    const sessions = parseResult(result) as unknown[];
    expect(sessions).toHaveLength(2);
  });

  it('session objects include all required fields', async () => {
    await store.createSession({ active: true, url: 'http://localhost:4200' });
    const result = await server.call('list_sessions');
    const sessions = parseResult(result) as Record<string, unknown>[];
    expect(sessions[0]).toMatchObject({
      id: expect.any(String),
      createdAt: expect.any(String),
      lastSeenAt: expect.any(String),
      active: true,
      url: 'http://localhost:4200',
    });
  });
});

// ── get_session ───────────────────────────────────────────────────────────────

describe('get_session', () => {
  it('returns session with its annotations for valid id', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    await store.createAnnotation(makeAnnotationPayload(session.id));
    const result = await server.call('get_session', { id: session.id });
    expect(isError(result)).toBe(false);
    const data = parseResult(result) as { session: Record<string, unknown>; annotations: unknown[] };
    expect(data.session.id).toBe(session.id);
    expect(data.annotations).toHaveLength(1);
  });

  it('returns error for unknown id', async () => {
    const result = await server.call('get_session', { id: 'nonexistent' });
    expect(isError(result)).toBe(true);
  });

  it('annotations array is filtered to only that session', async () => {
    const s1 = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const s2 = await store.createSession({ active: true, url: 'http://localhost:4200' });
    await store.createAnnotation(makeAnnotationPayload(s1.id));
    await store.createAnnotation(makeAnnotationPayload(s2.id));
    const result = await server.call('get_session', { id: s1.id });
    const data = parseResult(result) as { annotations: { sessionId: string }[] };
    expect(data.annotations).toHaveLength(1);
    expect(data.annotations[0].sessionId).toBe(s1.id);
  });
});

// ── get_pending ───────────────────────────────────────────────────────────────

describe('get_pending', () => {
  it('returns only pending annotations for the session', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.updateAnnotation(ann.id, { status: 'acknowledged' });
    await store.createAnnotation(makeAnnotationPayload(session.id));

    const result = await server.call('get_pending', { sessionId: session.id });
    const annotations = parseResult(result) as unknown[];
    expect(annotations).toHaveLength(1);
  });

  it('excludes non-pending statuses', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const a1 = await store.createAnnotation(makeAnnotationPayload(session.id));
    const a2 = await store.createAnnotation(makeAnnotationPayload(session.id));
    const a3 = await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.updateAnnotation(a1.id, { status: 'acknowledged' });
    await store.updateAnnotation(a2.id, { status: 'resolved' });
    await store.updateAnnotation(a3.id, { status: 'dismissed' });

    const result = await server.call('get_pending', { sessionId: session.id });
    const annotations = parseResult(result) as unknown[];
    expect(annotations).toHaveLength(0);
  });

  it('returns empty array when no pending annotations exist', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const result = await server.call('get_pending', { sessionId: session.id });
    expect(parseResult(result)).toEqual([]);
  });
});

// ── get_all_pending ───────────────────────────────────────────────────────────

describe('get_all_pending', () => {
  it('returns empty array when no pending annotations exist', async () => {
    const result = await server.call('get_all_pending');
    expect(parseResult(result)).toEqual([]);
  });

  it('returns pending annotations across all sessions sorted oldest first', async () => {
    const s1 = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const s2 = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const a1 = await store.createAnnotation(makeAnnotationPayload(s1.id));
    await new Promise((r) => setTimeout(r, 5));
    const a2 = await store.createAnnotation(makeAnnotationPayload(s2.id));

    const result = await server.call('get_all_pending');
    const annotations = parseResult(result) as { id: string }[];
    expect(annotations).toHaveLength(2);
    expect(annotations[0].id).toBe(a1.id);
    expect(annotations[1].id).toBe(a2.id);
  });

  it('excludes non-pending annotations', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.updateAnnotation(ann.id, { status: 'resolved' });

    const result = await server.call('get_all_pending');
    expect(parseResult(result)).toEqual([]);
  });
});

// ── acknowledge ───────────────────────────────────────────────────────────────

describe('acknowledge', () => {
  it('transitions annotation from pending to acknowledged', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const result = await server.call('acknowledge', { id: ann.id });
    expect(isError(result)).toBe(false);
    const updated = parseResult(result) as { status: string };
    expect(updated.status).toBe('acknowledged');
  });

  it('returns error if annotation does not exist', async () => {
    const result = await server.call('acknowledge', { id: 'nonexistent' });
    expect(isError(result)).toBe(true);
  });

  it('returns error if annotation is already acknowledged', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.updateAnnotation(ann.id, { status: 'acknowledged' });
    const result = await server.call('acknowledge', { id: ann.id });
    expect(isError(result)).toBe(true);
  });

  it('adds agent reply when message is provided', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await server.call('acknowledge', { id: ann.id, message: 'Got it' });
    const updated = await store.getAnnotation(ann.id);
    expect(updated?.replies).toHaveLength(1);
    expect(updated?.replies[0].message).toBe('Got it');
    expect(updated?.replies[0].author).toBe('agent');
  });

  it('does not add reply when no message provided', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await server.call('acknowledge', { id: ann.id });
    const updated = await store.getAnnotation(ann.id);
    expect(updated?.replies).toHaveLength(0);
  });
});

// ── resolve ───────────────────────────────────────────────────────────────────

describe('resolve', () => {
  it('transitions annotation from pending to resolved', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const result = await server.call('resolve', { id: ann.id });
    expect(isError(result)).toBe(false);
    const updated = parseResult(result) as { status: string };
    expect(updated.status).toBe('resolved');
  });

  it('transitions annotation from acknowledged to resolved', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.updateAnnotation(ann.id, { status: 'acknowledged' });
    const result = await server.call('resolve', { id: ann.id });
    const updated = parseResult(result) as { status: string };
    expect(updated.status).toBe('resolved');
  });

  it('adds reply with summary text when provided', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await server.call('resolve', { id: ann.id, summary: 'Fixed the typo in line 42' });
    const updated = await store.getAnnotation(ann.id);
    expect(updated?.replies).toHaveLength(1);
    expect(updated?.replies[0].message).toBe('Fixed the typo in line 42');
  });

  it('returns error if annotation does not exist', async () => {
    const result = await server.call('resolve', { id: 'nonexistent' });
    expect(isError(result)).toBe(true);
  });
});

// ── dismiss ───────────────────────────────────────────────────────────────────

describe('dismiss', () => {
  it('transitions annotation to dismissed and records reason', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const result = await server.call('dismiss', { id: ann.id, reason: 'Not a valid concern' });
    expect(isError(result)).toBe(false);
    const updated = parseResult(result) as { status: string };
    expect(updated.status).toBe('dismissed');
    const fetched = await store.getAnnotation(ann.id);
    expect(fetched?.replies[0].message).toBe('Not a valid concern');
  });

  it('returns error if reason is empty string', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const result = await server.call('dismiss', { id: ann.id, reason: '' });
    expect(isError(result)).toBe(true);
  });

  it('returns error if annotation does not exist', async () => {
    const result = await server.call('dismiss', { id: 'nonexistent', reason: 'reason' });
    expect(isError(result)).toBe(true);
  });
});

// ── reply ─────────────────────────────────────────────────────────────────────

describe('reply', () => {
  it('appends agent reply with correct message and author', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const result = await server.call('reply', { id: ann.id, message: 'Working on it' });
    expect(isError(result)).toBe(false);
    const updated = parseResult(result) as { replies: { message: string; author: string }[] };
    expect(updated.replies).toHaveLength(1);
    expect(updated.replies[0].message).toBe('Working on it');
    expect(updated.replies[0].author).toBe('agent');
  });

  it('returns error if annotation does not exist', async () => {
    const result = await server.call('reply', { id: 'nonexistent', message: 'Hi' });
    expect(isError(result)).toBe(true);
  });
});

// ── watch_annotations ─────────────────────────────────────────────────────────

describe('watch_annotations', () => {
  it('returns immediately when pending annotations already exist', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    await store.createAnnotation(makeAnnotationPayload(session.id));

    const start = Date.now();
    const result = await server.call('watch_annotations', { timeoutMs: 10000 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(200);
    const data = parseResult(result) as { status: string; annotations: unknown[] };
    expect(data.status).toBe('annotations');
    expect(data.annotations).toHaveLength(1);
  });

  it('returns timeout status after timeoutMs with no annotations', async () => {
    const start = Date.now();
    const result = await server.call('watch_annotations', { timeoutMs: 300 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThan(250);
    expect(elapsed).toBeLessThan(800);
    const data = parseResult(result) as { status: string };
    expect(data.status).toBe('timeout');
  }, 5000);

  it('returns early when annotation is created during wait', async () => {
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });

    // Create annotation after 150ms while watching
    setTimeout(() => {
      void store.createAnnotation(makeAnnotationPayload(session.id));
    }, 150);

    const start = Date.now();
    const result = await server.call('watch_annotations', { timeoutMs: 5000 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
    const data = parseResult(result) as { status: string; annotations: unknown[] };
    expect(data.status).toBe('annotations');
    expect(data.annotations).toHaveLength(1);
  }, 10000);

  it('filters by sessionId', async () => {
    const s1 = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const s2 = await store.createSession({ active: true, url: 'http://localhost:4200' });
    await store.createAnnotation(makeAnnotationPayload(s1.id));
    await store.createAnnotation(makeAnnotationPayload(s2.id));

    const result = await server.call('watch_annotations', { sessionId: s1.id, timeoutMs: 1000 });
    const data = parseResult(result) as { status: string; annotations: { sessionId: string }[] };
    expect(data.status).toBe('annotations');
    expect(data.annotations.every((a) => a.sessionId === s1.id)).toBe(true);
  });
});
