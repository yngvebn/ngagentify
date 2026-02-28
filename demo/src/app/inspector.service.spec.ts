import { InspectorService } from '@ng-annotate/angular';

describe('InspectorService', () => {
  let service: InspectorService;

  beforeEach(() => {
    service = new InspectorService();

    // Mock ng global
    (window as any).ng = {
      getComponent: vi.fn().mockReturnValue(null),
    };

    // Mock manifest
    (window as any).__NG_ANNOTATE_MANIFEST__ = {
      HeaderComponent: {
        component: 'src/app/header/header.component.ts',
        template: 'src/app/header/header.component.html',
      },
    };
  });

  afterEach(() => {
    delete (window as any).ng;
    delete (window as any).__NG_ANNOTATE_MANIFEST__;
  });

  it('returns null when no component found', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const result = service.getComponentContext(el);
    expect(result).toBeNull();

    document.body.removeChild(el);
  });

  it('resolves component name, selector, and file paths from manifest', () => {
    function HeaderComponent() {}
    (HeaderComponent as any).ɵcmp = { selectors: [['app-header']], inputs: {} };
    Object.defineProperty(HeaderComponent, 'name', { value: 'HeaderComponent' });

    const mockComponent = Object.create({ constructor: HeaderComponent });
    mockComponent.constructor = HeaderComponent;

    (window as any).ng.getComponent = vi.fn().mockReturnValue(mockComponent);

    const el = document.createElement('app-header');
    document.body.appendChild(el);

    const context = service.getComponentContext(el);

    expect(context).not.toBeNull();
    expect(context!.componentName).toBe('HeaderComponent');
    expect(context!.componentFilePath).toBe('src/app/header/header.component.ts');
    expect(context!.templateFilePath).toBe('src/app/header/header.component.html');
    expect(context!.selector).toBe('app-header');

    document.body.removeChild(el);
  });

  it('walks up DOM to find nearest component boundary', () => {
    function HeaderComponent() {}
    (HeaderComponent as any).ɵcmp = { selectors: [['app-header']], inputs: {} };
    Object.defineProperty(HeaderComponent, 'name', { value: 'HeaderComponent' });

    const mockComponent = { constructor: HeaderComponent };
    const parent = document.createElement('app-header');
    const child = document.createElement('div');
    parent.appendChild(child);
    document.body.appendChild(parent);

    (window as any).ng.getComponent = vi.fn().mockImplementation(
      (elem: Element) => (elem === parent ? mockComponent : null),
    );

    const context = service.getComponentContext(child);
    expect(context).not.toBeNull();
    expect(context!.componentName).toBe('HeaderComponent');

    document.body.removeChild(parent);
  });

  it('extracts @Input values from the component def', () => {
    function HeaderComponent() {}
    (HeaderComponent as any).ɵcmp = {
      selectors: [['app-header']],
      inputs: { title: 'title' },
    };
    Object.defineProperty(HeaderComponent, 'name', { value: 'HeaderComponent' });

    const mockComponent = { constructor: HeaderComponent, title: 'Hello world' };
    (window as any).ng.getComponent = vi.fn().mockReturnValue(mockComponent);

    const el = document.createElement('app-header');
    document.body.appendChild(el);

    const context = service.getComponentContext(el);
    expect(context!.inputs).toEqual({ title: 'Hello world' });

    document.body.removeChild(el);
  });

  it('caps domSnapshot at 5000 characters', () => {
    function HeaderComponent() {}
    (HeaderComponent as any).ɵcmp = { selectors: [['app-header']], inputs: {} };
    Object.defineProperty(HeaderComponent, 'name', { value: 'HeaderComponent' });

    const mockComponent = { constructor: HeaderComponent };
    (window as any).ng.getComponent = vi.fn().mockReturnValue(mockComponent);

    const el = document.createElement('app-header');
    el.setAttribute('data-big', 'x'.repeat(6000));
    document.body.appendChild(el);

    const context = service.getComponentContext(el);
    expect(context!.domSnapshot.length).toBeLessThanOrEqual(5020);

    document.body.removeChild(el);
  });
});
