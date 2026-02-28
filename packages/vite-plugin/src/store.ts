import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnnotationStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

export interface Session {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  active: boolean;
  url: string;
}

export interface AnnotationReply {
  id: string;
  createdAt: string;
  author: 'agent' | 'user';
  message: string;
}

export interface Annotation {
  id: string;
  sessionId: string;
  createdAt: string;
  status: AnnotationStatus;
  replies: AnnotationReply[];
  componentName: string;
  componentFilePath: string;
  templateFilePath?: string;
  selector: string;
  inputs: Record<string, unknown>;
  domSnapshot: string;
  componentTreePath: string[];
  annotationText: string;
  selectionText?: string;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface StoreData {
  sessions: Record<string, Session | undefined>;
  annotations: Record<string, Annotation | undefined>;
}

const EMPTY_STORE: StoreData = { sessions: {}, annotations: {} };

// ─── File paths ───────────────────────────────────────────────────────────────

export const STORE_DIR = '.ng-annotate';
let projectRoot = process.env.NG_ANNOTATE_PROJECT_ROOT ?? process.cwd();

/** Call from the Vite `configResolved` hook to pin the store to the Vite project root. */
export function setProjectRoot(root: string): void {
  projectRoot = root;
}

export function getStorePath(): string {
  return path.join(projectRoot, STORE_DIR, 'store.json');
}

// ─── Store init ───────────────────────────────────────────────────────────────

export function ensureStore(): void {
  const dir = path.join(projectRoot, STORE_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(getStorePath())) {
    fs.writeFileSync(getStorePath(), JSON.stringify(EMPTY_STORE, null, 2), 'utf8');
  }
}

// ─── File locking ─────────────────────────────────────────────────────────────

// In-process mutex: serializes all writes from the same process using a promise chain.
// writeQueue always resolves (never rejects) so the chain is never broken by a
// failing task. The Promise returned to the caller still rejects on error.
// Note: cross-process safety (Vite plugin + MCP server) can be layered on top
// via proper-lockfile if needed, but requires a platform-reliable approach.
let writeQueue: Promise<unknown> = Promise.resolve();

async function withLock<T>(fn: (data: StoreData) => StoreData | Promise<StoreData>): Promise<T> {
  ensureStore();

  const result = writeQueue.then(async () => {
    const raw = fs.readFileSync(getStorePath(), 'utf8');
    const data = JSON.parse(raw) as StoreData;
    const updated = await fn(data);
    fs.writeFileSync(getStorePath(), JSON.stringify(updated, null, 2), 'utf8');
    return updated as unknown as T;
  });

  // Keep the queue alive even when this task fails
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  writeQueue = result.catch(() => {});
  return result;
}

function readStore(): StoreData {
  ensureStore();
  return JSON.parse(fs.readFileSync(getStorePath(), 'utf8')) as StoreData;
}

// ─── Pub/sub watchers ─────────────────────────────────────────────────────────

type WatcherFn = (annotation: Annotation) => void;
const watchers = new Set<WatcherFn>();

export function addWatcher(fn: WatcherFn): () => void {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

function notifyWatchers(annotation: Annotation): void {
  for (const fn of watchers) fn(annotation);
}

// ─── Store API ────────────────────────────────────────────────────────────────

export const store = {
  async createSession(payload: Omit<Session, 'id' | 'createdAt' | 'lastSeenAt'>): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: uuidv4(),
      createdAt: now,
      lastSeenAt: now,
      ...payload,
    };
    await withLock<StoreData>((data) => {
      data.sessions[session.id] = session;
      return data;
    });
    return session;
  },

  async updateSession(id: string, patch: Partial<Session>): Promise<Session | undefined> {
    let result: Session | undefined;
    await withLock<StoreData>((data) => {
      const existing = data.sessions[id];
      if (!existing) return data;
      const updated: Session = { ...existing, ...patch, id };
      data.sessions[id] = updated;
      result = updated;
      return data;
    });
    return result;
  },

  listSessions(): Promise<Session[]> {
    const data = readStore();
    return Promise.resolve(Object.values(data.sessions).filter((s): s is Session => s !== undefined));
  },

  getSession(id: string): Promise<Session | undefined> {
    const data = readStore();
    return Promise.resolve(data.sessions[id]);
  },

  async createAnnotation(
    payload: Omit<Annotation, 'id' | 'createdAt' | 'status' | 'replies'>,
  ): Promise<Annotation> {
    const annotation: Annotation = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      replies: [],
      ...payload,
    };
    await withLock<StoreData>((data) => {
      data.annotations[annotation.id] = annotation;
      return data;
    });
    notifyWatchers(annotation);
    return annotation;
  },

  getAnnotation(id: string): Promise<Annotation | undefined> {
    const data = readStore();
    return Promise.resolve(data.annotations[id]);
  },

  listAnnotations(sessionId?: string, status?: AnnotationStatus): Promise<Annotation[]> {
    const data = readStore();
    let list = Object.values(data.annotations).filter((a): a is Annotation => a !== undefined);
    if (sessionId) list = list.filter((a) => a.sessionId === sessionId);
    if (status) list = list.filter((a) => a.status === status);
    return Promise.resolve(list.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  },

  async updateAnnotation(id: string, patch: Partial<Annotation>): Promise<Annotation | undefined> {
    let result: Annotation | undefined;
    await withLock<StoreData>((data) => {
      const existing = data.annotations[id];
      if (!existing) return data;
      const updated: Annotation = { ...existing, ...patch, id };
      data.annotations[id] = updated;
      result = updated;
      return data;
    });
    return result;
  },

  async addReply(
    annotationId: string,
    reply: Omit<AnnotationReply, 'id' | 'createdAt'>,
  ): Promise<Annotation | undefined> {
    let result: Annotation | undefined;
    await withLock<StoreData>((data) => {
      const annotation = data.annotations[annotationId];
      if (!annotation) return data;
      const newReply: AnnotationReply = {
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        ...reply,
      };
      annotation.replies.push(newReply);
      result = annotation;
      return data;
    });
    return result;
  },
};
