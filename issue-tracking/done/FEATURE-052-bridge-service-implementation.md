---
id: FEATURE-052-bridge-service-implementation
type: feature
priority: high
effort: 3h
status: done
labels: [angular, phase-6]
depends_on: [FEATURE-051-inspector-service-tests, FEATURE-049-angular-types-file]
blocks: [FEATURE-053-bridge-service-tests]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement packages/angular/src/bridge.service.ts

## Summary

Implement the `BridgeService` that manages the WebSocket connection to the Vite plugin, handles reconnections, and exposes reactive observables for session and annotation state.

## Acceptance Criteria

File: `packages/angular/src/bridge.service.ts`

- `@Injectable()` class `BridgeService implements OnDestroy`
- Constructor injects `NgZone`
- Properties:
  - `session$: BehaviorSubject<Session | null>` initialized to `null`
  - `annotations$: BehaviorSubject<Annotation[]>` initialized to `[]`
  - `connected$: BehaviorSubject<boolean>` initialized to `false`
- `init()` method: calls `this.connect()`
- `private connect()` method:
  - Creates `new WebSocket(\`ws://${location.host}/__annotate\`)`
  - `onopen`: sets `connected$.next(true)`, optionally sends a ping
  - `onmessage`: runs inside `this.zone.run(() => { ... })` to ensure change detection:
    - `session:created` → `session$.next(data.session)`
    - `annotations:sync` → `annotations$.next(data.annotations)`
    - `annotation:created` → appends to `annotations$` array
  - `onclose`: sets `connected$.next(false)`, schedules reconnect via `setTimeout(this.connect, 3000)`
  - `onerror`: logs to console (no crash)
- `createAnnotation(payload)`: sends `{ type: 'annotation:create', payload }` via `this.send()`
- `replyToAnnotation(id, message)`: sends `{ type: 'annotation:reply', id, message }`
- `deleteAnnotation(id)`: sends `{ type: 'annotation:delete', id }`
- `private send(msg)`: checks `ws.readyState === WebSocket.OPEN` before sending; serializes to JSON
- `ngOnDestroy()`: clears timers, closes WebSocket
- TypeScript compiles without errors, ESLint passes

## Technical Notes

- `NgZone.run()` is required because WebSocket events fire outside the Angular zone — without it, change detection won't trigger on message receipt
- The reconnect timer reference (`reconnectTimer`) must be stored and cleared in `ngOnDestroy` to prevent memory leaks
