import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { NgZone } from '@angular/core';
import { OverlayComponent, InspectorService, BridgeService } from '@ng-annotate/angular';
import type { Annotation, ComponentContext } from '@ng-annotate/angular';


const mockContext: ComponentContext = {
  componentName: 'TestComponent',
  componentFilePath: 'src/app/test.component.ts',
  selector: 'app-test',
  inputs: {},
  domSnapshot: '<app-test></app-test>',
  componentTreePath: ['AppComponent'],
};

describe('OverlayComponent', () => {
  let fixture: ComponentFixture<OverlayComponent>;
  let component: OverlayComponent;
  let inspectorSpy: { getComponentContext: ReturnType<typeof vi.fn> } & InspectorService;
  let bridgeSpy: {
    createAnnotation: ReturnType<typeof vi.fn>;
    replyToAnnotation: ReturnType<typeof vi.fn>;
    deleteAnnotation: ReturnType<typeof vi.fn>;
    approveDiff: ReturnType<typeof vi.fn>;
    rejectDiff: ReturnType<typeof vi.fn>;
    annotations$: BehaviorSubject<Annotation[]>;
    session$: BehaviorSubject<null>;
    connected$: BehaviorSubject<boolean>;
  };

  beforeEach(async () => {
    const annotations$ = new BehaviorSubject<Annotation[]>([]);

    inspectorSpy = {
      getComponentContext: vi.fn().mockReturnValue(null),
    } as any;

    bridgeSpy = {
      createAnnotation: vi.fn(),
      replyToAnnotation: vi.fn(),
      deleteAnnotation: vi.fn(),
      approveDiff: vi.fn(),
      rejectDiff: vi.fn(),
      annotations$,
      session$: new BehaviorSubject(null),
      connected$: new BehaviorSubject(false),
    } as any;

    await TestBed.configureTestingModule({
      imports: [OverlayComponent],
      providers: [
        { provide: InspectorService, useValue: inspectorSpy },
        { provide: BridgeService, useValue: bridgeSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts in hidden mode', () => {
    expect(component.mode).toBe('hidden');
  });

  it('Alt+Shift+A transitions from hidden to inspect mode', () => {
    component.toggleInspect();
    expect(component.mode).toBe('inspect');
  });

  it('Alt+Shift+A again returns to hidden from inspect mode', () => {
    component.mode = 'inspect';
    component.toggleInspect();
    expect(component.mode).toBe('hidden');
  });

  it('click when inspect mode finds component transitions to annotate', () => {
    component.mode = 'inspect';
    inspectorSpy.getComponentContext.mockReturnValue(mockContext);

    const el = document.createElement('app-test');
    document.body.appendChild(el);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: el });
    component.onClick(event);

    expect(component.mode).toBe('annotate');
    expect(component.selectedContext).toEqual(mockContext);

    document.body.removeChild(el);
  });

  it('click when inspect mode finds no component stays in inspect', () => {
    component.mode = 'inspect';
    inspectorSpy.getComponentContext.mockReturnValue(null);

    const el = document.createElement('div');
    document.body.appendChild(el);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: el });
    component.onClick(event);

    expect(component.mode).toBe('inspect');

    document.body.removeChild(el);
  });

  it('Escape from annotate returns to inspect', () => {
    component.mode = 'annotate';
    component.onEscape();
    expect(component.mode).toBe('inspect');
  });

  it('Escape from inspect returns to hidden', () => {
    component.mode = 'inspect';
    component.onEscape();
    expect(component.mode).toBe('hidden');
  });

  it('Escape from thread returns to hidden', () => {
    component.mode = 'thread';
    component.onEscape();
    expect(component.mode).toBe('hidden');
  });

  it('submit with blank annotationText does nothing', () => {
    component.mode = 'annotate';
    component.selectedContext = mockContext;
    component.annotationText = '   ';

    component.submit();

    expect(bridgeSpy.createAnnotation).not.toHaveBeenCalled();
    expect(component.mode).toBe('annotate');
  });

  it('submit with valid text calls createAnnotation and resets', () => {
    component.mode = 'annotate';
    component.selectedContext = mockContext;
    component.annotationText = 'Fix this';

    TestBed.inject(NgZone).run(() => {
      component.submit();
    });

    expect(bridgeSpy.createAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({ annotationText: 'Fix this' }),
    );
    expect(component.selectedContext).toBeNull();
    expect(component.annotationText).toBe('');
  });

  // ── preview mode ────────────────────────────────────────────────────────────

  it('Escape from preview returns to hidden', () => {
    component.mode = 'preview';
    component.onEscape();
    expect(component.mode).toBe('hidden');
  });

  it('openThread with diff_proposed annotation opens preview mode', () => {
    const diffAnnotation = {
      id: 'ann-1',
      sessionId: 'sess-1',
      createdAt: new Date().toISOString(),
      status: 'diff_proposed' as const,
      replies: [],
      componentName: 'TestComponent',
      componentFilePath: 'src/app/test.component.ts',
      selector: 'app-test',
      inputs: {},
      domSnapshot: '',
      componentTreePath: [],
      annotationText: 'Fix it',
      diff: '--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old\n+new',
    };

    component.openThread(diffAnnotation);

    expect(component.mode).toBe('preview');
    expect(component.diffAnnotation).toBe(diffAnnotation);
  });

  it('openThread without diff opens thread mode even if status is diff_proposed', () => {
    const noDiffAnnotation = {
      id: 'ann-2',
      sessionId: 'sess-1',
      createdAt: new Date().toISOString(),
      status: 'diff_proposed' as const,
      replies: [],
      componentName: 'TestComponent',
      componentFilePath: 'src/app/test.component.ts',
      selector: 'app-test',
      inputs: {},
      domSnapshot: '',
      componentTreePath: [],
      annotationText: 'Fix it',
    };

    component.openThread(noDiffAnnotation);

    expect(component.mode).toBe('thread');
  });

  it('approveDiff calls bridge.approveDiff and resets to hidden', () => {
    const diffAnnotation = {
      id: 'ann-3',
      sessionId: 'sess-1',
      createdAt: new Date().toISOString(),
      status: 'diff_proposed' as const,
      replies: [],
      componentName: 'TestComponent',
      componentFilePath: 'src/app/test.component.ts',
      selector: 'app-test',
      inputs: {},
      domSnapshot: '',
      componentTreePath: [],
      annotationText: 'Fix it',
      diff: '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new',
    };

    component.diffAnnotation = diffAnnotation;
    component.mode = 'preview';
    component.approveDiff();

    expect(bridgeSpy.approveDiff).toHaveBeenCalledWith('ann-3');
    expect(component.diffAnnotation).toBeNull();
    expect(component.mode).toBe('hidden');
  });

  it('rejectDiff calls bridge.rejectDiff and resets to hidden', () => {
    const diffAnnotation = {
      id: 'ann-4',
      sessionId: 'sess-1',
      createdAt: new Date().toISOString(),
      status: 'diff_proposed' as const,
      replies: [],
      componentName: 'TestComponent',
      componentFilePath: 'src/app/test.component.ts',
      selector: 'app-test',
      inputs: {},
      domSnapshot: '',
      componentTreePath: [],
      annotationText: 'Fix it',
      diff: '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new',
    };

    component.diffAnnotation = diffAnnotation;
    component.mode = 'preview';
    component.rejectDiff();

    expect(bridgeSpy.rejectDiff).toHaveBeenCalledWith('ann-4');
    expect(component.diffAnnotation).toBeNull();
    expect(component.mode).toBe('hidden');
  });

  it('diffLines parses add, remove, hunk and context lines', () => {
    component.diffAnnotation = {
      id: 'ann-5',
      sessionId: 'sess-1',
      createdAt: new Date().toISOString(),
      status: 'diff_proposed' as const,
      replies: [],
      componentName: 'TestComponent',
      componentFilePath: 'src/app/test.component.ts',
      selector: 'app-test',
      inputs: {},
      domSnapshot: '',
      componentTreePath: [],
      annotationText: 'Fix it',
      diff: '@@ -1,2 +1,2 @@\n context\n-removed\n+added',
    };

    const lines = component.diffLines();

    expect(lines).toHaveLength(4);
    expect(lines[0].type).toBe('hunk');
    expect(lines[1].type).toBe('context');
    expect(lines[2].type).toBe('remove');
    expect(lines[3].type).toBe('add');
  });

  it('diffLines returns empty array when diffAnnotation has no diff', () => {
    component.diffAnnotation = null;
    expect(component.diffLines()).toEqual([]);
  });

  it('annotations sync auto-transitions thread to preview when diff arrives', () => {
    const annotation = {
      id: 'ann-6',
      sessionId: 'sess-1',
      createdAt: new Date().toISOString(),
      status: 'acknowledged' as const,
      replies: [],
      componentName: 'TestComponent',
      componentFilePath: 'src/app/test.component.ts',
      selector: 'app-test',
      inputs: {},
      domSnapshot: '',
      componentTreePath: [],
      annotationText: 'Fix it',
    };

    component.threadAnnotation = annotation;
    component.mode = 'thread';
    fixture.detectChanges();

    const withDiff = {
      ...annotation,
      status: 'diff_proposed' as const,
      diff: '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new',
    };

    TestBed.inject(NgZone).run(() => {
      bridgeSpy.annotations$.next([withDiff]);
    });
    fixture.detectChanges();

    expect(component.mode).toBe('preview');
    expect(component.diffAnnotation).toEqual(withDiff);
  });
});
