---
id: FEATURE-049-angular-types-file
type: feature
priority: high
effort: 1h
status: done
labels: [angular, phase-5]
depends_on: [FEATURE-048-manifest-tests, FEATURE-004-angular-stub-package]
blocks: [FEATURE-050-inspector-service-implementation]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create packages/angular/src/types.ts

## Summary

Create the shared types file for the Angular package that re-exports or mirrors the Annotation and Session interfaces from the store, so the bridge service and overlay component have the correct types.

## Acceptance Criteria

File: `packages/angular/src/types.ts`

- Exports `Annotation` interface matching the spec exactly:
  ```ts
  export type AnnotationStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  export interface AnnotationReply { id: string; createdAt: string; author: 'agent' | 'user'; message: string; }
  export interface Annotation { id: string; sessionId: string; createdAt: string; status: AnnotationStatus; replies: AnnotationReply[]; componentName: string; componentFilePath: string; templateFilePath?: string; selector: string; inputs: Record<string, unknown>; domSnapshot: string; componentTreePath: string[]; annotationText: string; selectionText?: string; }
  ```
- Exports `Session` interface matching the spec exactly
- TypeScript compiles without errors

## Technical Notes

- Do NOT import from `../../vite-plugin/src/store` in the Angular package — that would create a cross-package dependency from the browser package to the Node package. Duplicate the type definitions here
- The types must match the store types exactly; if the store types change, these must be updated too
- `packages/angular/src/index.ts` should export everything from `./types`
