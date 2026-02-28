import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { Session, Annotation } from './types.js';

type BridgeMessage =
  | { type: 'session:created'; session: Session }
  | { type: 'annotations:sync'; annotations: Annotation[] }
  | { type: 'annotation:created'; annotation: Annotation }
  | { type: string };

@Injectable()
export class BridgeService implements OnDestroy {
  readonly session$ = new BehaviorSubject<Session | null>(null);
  readonly annotations$ = new BehaviorSubject<Annotation[]>([]);
  readonly connected$ = new BehaviorSubject<boolean>(false);

  private readonly zone = inject(NgZone);
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  init(): void {
    this.connect();
  }

  private connect(): void {
    const wsUrl = `ws://${location.host}/__annotate`;
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
            this.session$.next((data as Extract<BridgeMessage, { type: 'session:created' }>).session);
          } else if (data.type === 'annotations:sync') {
            this.annotations$.next(
              (data as Extract<BridgeMessage, { type: 'annotations:sync' }>).annotations,
            );
          } else if (data.type === 'annotation:created') {
            const annotation = (
              data as Extract<BridgeMessage, { type: 'annotation:created' }>
            ).annotation;
            const current = this.annotations$.getValue();
            this.annotations$.next([...current, annotation]);
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
