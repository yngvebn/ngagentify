import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { Annotation, Session } from './types';

type BridgeMessage =
  | { type: 'session:created'; session: Session }
  | { type: 'session:updated'; session: Session }
  | { type: 'annotations:sync'; annotations: Annotation[]; lastAgentHeartbeat?: string }
  | { type: 'annotation:created'; annotation: Annotation }
  | { type: 'manifest:update'; manifest: Record<string, unknown> }
  | { type: string };

const SESSION_STORAGE_KEY = 'ng-annotate:sessionId';

@Injectable()
export class BridgeService implements OnDestroy {
  readonly session$ = new BehaviorSubject<Session | null>(null);
  readonly annotations$ = new BehaviorSubject<Annotation[]>([]);
  readonly connected$ = new BehaviorSubject<boolean>(false);
  readonly agentLastSeen$ = new BehaviorSubject<string | null>(null);

  private readonly zone = inject(NgZone);
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  init(): void {
    this.connect();
  }

  private connect(): void {
    const storedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    const params = storedSessionId ? `?sessionId=${encodeURIComponent(storedSessionId)}` : '';
    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/__annotate${params}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.zone.run(() => {
        this.connected$.next(true);
      });
    };

    this.ws.onmessage = (event: MessageEvent<string>) => {
      this.zone.run(() => {
        try {
          const data = JSON.parse(event.data) as BridgeMessage;
          if (data.type === 'session:created') {
            const session = (data as Extract<BridgeMessage, { type: 'session:created' }>).session;
            localStorage.setItem(SESSION_STORAGE_KEY, session.id);
            this.session$.next(session);
          } else if (data.type === 'annotations:sync') {
            const { annotations, lastAgentHeartbeat } = data as Extract<BridgeMessage, { type: 'annotations:sync' }>;
            this.annotations$.next(annotations);
            if (lastAgentHeartbeat !== undefined) {
              this.agentLastSeen$.next(lastAgentHeartbeat);
            }
          } else if (data.type === 'session:updated') {
            const session = (data as Extract<BridgeMessage, { type: 'session:updated' }>).session;
            this.session$.next(session);
          } else if (data.type === 'annotation:created') {
            const annotation = (
              data as Extract<BridgeMessage, { type: 'annotation:created' }>
            ).annotation;
            const current = this.annotations$.getValue();
            this.annotations$.next([...current, annotation]);
          } else if (data.type === 'manifest:update') {
            const { manifest } = data as Extract<BridgeMessage, { type: 'manifest:update' }>;
            (window as unknown as { __NG_ANNOTATE_MANIFEST__?: unknown }).__NG_ANNOTATE_MANIFEST__ = manifest;
          }
        } catch {
          // ignore malformed messages
        }
      });
    };

    this.ws.onclose = () => {
      this.zone.run(() => {
        this.connected$.next(false);
        this.reconnectTimer = setTimeout(() => { this.connect(); }, 3000);
      });
    };

    this.ws.onerror = (event) => {
      console.warn('[ng-annotate] WebSocket error', event);
    };
  }

  createAnnotation(payload: Record<string, unknown>): void {
    this.send({ type: 'annotation:create', payload });
  }

  replyToAnnotation(id: string, message: string): void {
    this.send({ type: 'annotation:reply', id, message });
  }

  deleteAnnotation(id: string): void {
    this.send({ type: 'annotation:delete', id });
  }

  approveDiff(id: string): void {
    this.send({ type: 'diff:approved', id });
  }

  rejectDiff(id: string): void {
    this.send({ type: 'diff:rejected', id });
  }

  clearAnnotations(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    this.send({ type: 'annotations:clear' });
  }

  toggleYoloMode(): void {
    this.send({ type: 'session:yolo-toggle' });
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  ngOnDestroy(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
  }
}
