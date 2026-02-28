import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { BridgeService } from '@ng-annotate/angular';

describe('BridgeService', () => {
  let service: BridgeService;
  let mockWs: any;
  let MockWebSocket: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // WebSocket.OPEN
      onopen: null as any,
      onmessage: null as any,
      onclose: null as any,
      onerror: null as any,
    };

    MockWebSocket = vi.fn().mockImplementation(function () { return mockWs; });
    Object.assign(MockWebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
    vi.stubGlobal('WebSocket', MockWebSocket);

    TestBed.configureTestingModule({ providers: [BridgeService] });
    service = TestBed.inject(BridgeService);
    service.init();
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.unstubAllGlobals();
  });

  it('emits session on session:created message', () => {
    const session = { id: 'abc', createdAt: '', lastSeenAt: '', active: true, url: '' };

    TestBed.inject(NgZone).run(() => {
      mockWs.onmessage({ data: JSON.stringify({ type: 'session:created', session }) });
    });

    expect(service.session$.value).toEqual(session);
  });

  it('sends annotation:create message with correct payload', () => {
    service.createAnnotation({ componentName: 'TestComponent', annotationText: 'Fix this' });

    expect(mockWs.send).toHaveBeenCalledTimes(1);
    const sentMsg = JSON.parse(mockWs.send.mock.calls[0][0] as string) as any;
    expect(sentMsg.type).toBe('annotation:create');
    expect(sentMsg.payload.componentName).toBe('TestComponent');
    expect(sentMsg.payload.annotationText).toBe('Fix this');
  });

  it('updates annotations$ when annotations:sync received', () => {
    const annotations = [{ id: '1', status: 'pending' }];

    TestBed.inject(NgZone).run(() => {
      mockWs.onmessage({ data: JSON.stringify({ type: 'annotations:sync', annotations }) });
    });

    expect(service.annotations$.value).toEqual(annotations as any);
  });

  it('attempts reconnection after socket close', () => {
    vi.useFakeTimers();

    const initialCallCount = MockWebSocket.mock.calls.length;

    TestBed.inject(NgZone).run(() => {
      mockWs.onclose(new CloseEvent('close'));
    });

    vi.advanceTimersByTime(3100);

    expect(MockWebSocket.mock.calls.length).toBeGreaterThan(initialCallCount);

    vi.useRealTimers();
  });
});
