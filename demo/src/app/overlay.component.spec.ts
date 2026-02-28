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
});
