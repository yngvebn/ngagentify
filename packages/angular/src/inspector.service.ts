import { Injectable } from '@angular/core';
import type { ComponentContext } from './types.js';

interface NgDevMode {
  getComponent: (element: Element) => unknown;
}

declare const ng: NgDevMode;

interface NgCmp {
  selectors?: unknown[][];
  inputs?: Record<string, string>;
}

interface ComponentInstance {
  constructor: { name: string; ɵcmp?: NgCmp } & (new (...args: unknown[]) => unknown);
  [key: string]: unknown;
}

interface ManifestEntry {
  component: string;
  template?: string;
}

const DOM_SNAPSHOT_MAX = 5000;

@Injectable()
export class InspectorService {
  getComponentContext(element: Element): ComponentContext | null {
    const component = this.findNearestComponent(element);
    if (!component) return null;

    const componentName = (component as ComponentInstance).constructor.name;
    const { component: componentFilePath, template: templateFilePath } =
      this.resolveFilePaths(componentName);
    const selector = this.getSelector(component as ComponentInstance);
    const inputs = this.getInputs(component as ComponentInstance);
    const domSnapshot = this.snapshot(element);
    const componentTreePath = this.buildTreePath(element);

    return {
      componentName,
      componentFilePath,
      ...(templateFilePath ? { templateFilePath } : {}),
      selector,
      inputs,
      domSnapshot,
      componentTreePath,
    };
  }

  private findNearestComponent(element: Element): unknown {
    let current: Element | null = element;
    while (current) {
      try {
        const comp = ng.getComponent(current);
        if (comp) return comp;
      } catch {
        // ignore
      }
      current = current.parentElement;
    }
    return null;
  }

  private getSelector(component: ComponentInstance): string {
    try {
      const cmp = component.constructor.ɵcmp;
      if (!cmp?.selectors?.length) return 'unknown-selector';
      const first = cmp.selectors[0];
      if (!first.length) return 'unknown-selector';

      // Element selector: [['app-foo']]
      // Attribute selector: [['', 'appFoo', '']]
      if (first[0] === '') {
        // Attribute selector — find non-empty entries
        const attrParts: string[] = [];
        for (let i = 1; i < first.length; i += 2) {
          if (typeof first[i] === 'string' && first[i]) {
            attrParts.push(`[${String(first[i])}]`);
          }
        }
        return attrParts.join('') || 'unknown-selector';
      }
      return String(first[0]);
    } catch {
      return 'unknown-selector';
    }
  }

  private getInputs(component: ComponentInstance): Record<string, unknown> {
    try {
      const cmp = component.constructor.ɵcmp;
      if (!cmp?.inputs) return {};
      const result: Record<string, unknown> = {};
      for (const [propName] of Object.entries(cmp.inputs)) {
        if (typeof propName === 'symbol') continue;
        if (propName.startsWith('ɵ')) continue;
        result[propName] = (component as Record<string, unknown>)[propName];
      }
      return result;
    } catch {
      return {};
    }
  }

  private buildTreePath(element: Element): string[] {
    const path: string[] = [];
    let current: Element | null = element.parentElement;
    while (current) {
      try {
        const comp = ng.getComponent(current);
        if (comp) {
          path.unshift((comp as ComponentInstance).constructor.name);
        }
      } catch {
        // ignore
      }
      current = current.parentElement;
    }
    return path;
  }

  private snapshot(element: Element): string {
    const html = element.outerHTML;
    if (html.length <= DOM_SNAPSHOT_MAX) return html;
    return html.slice(0, DOM_SNAPSHOT_MAX) + '<!-- truncated -->';
  }

  private resolveFilePaths(componentName: string): { component: string; template?: string } {
    try {
      const manifest = (window as unknown as { __NG_ANNOTATE_MANIFEST__?: Record<string, ManifestEntry> })
        .__NG_ANNOTATE_MANIFEST__;
      const entry = manifest?.[componentName];
      if (entry) return entry;
    } catch {
      // ignore
    }
    return { component: `(unresolved: ${componentName})` };
  }
}
