import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Each test gets its own temp dir; the store module is re-imported fresh each time
// because STORE_PATH is computed from process.cwd() at module evaluation time.

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-annotate-test-'));
  process.chdir(tempDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function getStore() {
  const mod = await import('./store.js');
  return mod.store;
}

// ── createSession ─────────────────────────────────────────────────────────────

describe('store.createSession', () => {
  it('assigns a UUID id', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    expect(session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('sets createdAt and lastSeenAt as ISO strings', async () => {
    const store = await getStore();
    const before = new Date().toISOString();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const after = new Date().toISOString();
    expect(session.createdAt >= before).toBe(true);
    expect(session.createdAt <= after).toBe(true);
    expect(session.lastSeenAt).toBe(session.createdAt);
  });

  it('persists to the store file', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const raw = fs.readFileSync(path.join(tempDir, '.ng-annotate', 'store.json'), 'utf8');
    const data = JSON.parse(raw);
    expect(data.sessions[session.id]).toBeDefined();
    expect(data.sessions[session.id].id).toBe(session.id);
  });

  it('returns the full session object', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    expect(session).toMatchObject({
      active: true,
      url: 'http://localhost:4200',
    });
    expect(typeof session.id).toBe('string');
    expect(typeof session.createdAt).toBe('string');
  });
});

// ── createAnnotation ──────────────────────────────────────────────────────────

describe('store.createAnnotation', () => {
  it('assigns a UUID id', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    expect(ann.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('sets status to pending', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    expect(ann.status).toBe('pending');
  });

  it('sets replies to empty array', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    expect(ann.replies).toEqual([]);
  });

  it('sets createdAt as ISO string', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const before = new Date().toISOString();
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const after = new Date().toISOString();
    expect(ann.createdAt >= before).toBe(true);
    expect(ann.createdAt <= after).toBe(true);
  });

  it('persists to the store file', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const raw = fs.readFileSync(path.join(tempDir, '.ng-annotate', 'store.json'), 'utf8');
    const data = JSON.parse(raw);
    expect(data.annotations[ann.id]).toBeDefined();
  });

  it('returns the full annotation object', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    expect(ann.annotationText).toBe('Fix the typo');
    expect(ann.componentName).toBe('TestComponent');
  });
});

// ── listAnnotations ───────────────────────────────────────────────────────────

describe('store.listAnnotations', () => {
  it('returns all annotations with no filters', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.createAnnotation(makeAnnotationPayload(session.id));
    const list = await store.listAnnotations();
    expect(list).toHaveLength(2);
  });

  it('filters correctly by status', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.updateAnnotation(ann.id, { status: 'acknowledged' });
    await store.createAnnotation(makeAnnotationPayload(session.id));

    const pending = await store.listAnnotations(undefined, 'pending');
    const acknowledged = await store.listAnnotations(undefined, 'acknowledged');
    expect(pending).toHaveLength(1);
    expect(acknowledged).toHaveLength(1);
  });

  it('filters correctly by sessionId', async () => {
    const store = await getStore();
    const s1 = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const s2 = await store.createSession({ active: true, url: 'http://localhost:4200' });
    await store.createAnnotation(makeAnnotationPayload(s1.id));
    await store.createAnnotation(makeAnnotationPayload(s2.id));

    const list = await store.listAnnotations(s1.id);
    expect(list).toHaveLength(1);
    expect(list[0].sessionId).toBe(s1.id);
  });

  it('returns results sorted oldest-first', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const a1 = await store.createAnnotation(makeAnnotationPayload(session.id));
    await new Promise((r) => setTimeout(r, 5));
    const a2 = await store.createAnnotation(makeAnnotationPayload(session.id));

    const list = await store.listAnnotations();
    expect(list[0].id).toBe(a1.id);
    expect(list[1].id).toBe(a2.id);
  });
});

// ── addReply ──────────────────────────────────────────────────────────────────

describe('store.addReply', () => {
  it('appends a reply with generated UUID id and ISO createdAt', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const updated = await store.addReply(ann.id, { author: 'agent', message: 'Got it' });
    expect(updated?.replies).toHaveLength(1);
    expect(updated?.replies[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(updated?.replies[0].createdAt).toBeTruthy();
    expect(updated?.replies[0].author).toBe('agent');
    expect(updated?.replies[0].message).toBe('Got it');
  });

  it('returns undefined for unknown annotation id', async () => {
    const store = await getStore();
    await store.createSession({ active: true, url: 'http://localhost:4200' });
    const result = await store.addReply('nonexistent-id', { author: 'agent', message: 'Hi' });
    expect(result).toBeUndefined();
  });
});

// ── updateAnnotation ──────────────────────────────────────────────────────────

describe('store.updateAnnotation', () => {
  it('merges the patch into the existing annotation', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const updated = await store.updateAnnotation(ann.id, { status: 'acknowledged' });
    expect(updated?.status).toBe('acknowledged');
    expect(updated?.componentName).toBe('TestComponent');
  });

  it('returns undefined for unknown annotation id', async () => {
    const store = await getStore();
    const result = await store.updateAnnotation('nonexistent-id', { status: 'resolved' });
    expect(result).toBeUndefined();
  });
});

// ── Concurrent access ─────────────────────────────────────────────────────────

describe('concurrent access', () => {
  it('handles 10 parallel createAnnotation calls without data loss', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const promises = Array.from({ length: 10 }, () =>
      store.createAnnotation(makeAnnotationPayload(session.id)),
    );
    await Promise.all(promises);
    const list = await store.listAnnotations();
    expect(list).toHaveLength(10);
  });
}, 15000);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAnnotationPayload(sessionId: string) {
  return {
    sessionId,
    componentName: 'TestComponent',
    componentFilePath: 'src/app/test/test.component.ts',
    selector: 'app-test',
    inputs: { title: 'Hello' },
    domSnapshot: '<app-test><p>Hello</p></app-test>',
    componentTreePath: ['AppComponent'],
    annotationText: 'Fix the typo',
  };
}

// ── diff preview fields ───────────────────────────────────────────────────────

describe('store: diff preview fields', () => {
  it('createAnnotation does not set diff or diffResponse', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    expect(ann.diff).toBeUndefined();
    expect(ann.diffResponse).toBeUndefined();
  });

  it('updateAnnotation can set diff and status diff_proposed', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    const diff = '--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old\n+new';
    const updated = await store.updateAnnotation(ann.id, { status: 'diff_proposed', diff });
    expect(updated?.status).toBe('diff_proposed');
    expect(updated?.diff).toBe(diff);
  });

  it('updateAnnotation can set diffResponse to approved', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.updateAnnotation(ann.id, { status: 'diff_proposed', diff: '...' });
    const updated = await store.updateAnnotation(ann.id, { diffResponse: 'approved' });
    expect(updated?.diffResponse).toBe('approved');
  });

  it('updateAnnotation can set diffResponse to rejected', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.updateAnnotation(ann.id, { status: 'diff_proposed', diff: '...' });
    const updated = await store.updateAnnotation(ann.id, { diffResponse: 'rejected' });
    expect(updated?.diffResponse).toBe('rejected');
  });

  it('diff_proposed is a valid listAnnotations status filter', async () => {
    const store = await getStore();
    const session = await store.createSession({ active: true, url: 'http://localhost:4200' });
    const ann = await store.createAnnotation(makeAnnotationPayload(session.id));
    await store.updateAnnotation(ann.id, { status: 'diff_proposed', diff: '...' });
    const list = await store.listAnnotations(undefined, 'diff_proposed');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(ann.id);
  });
});
