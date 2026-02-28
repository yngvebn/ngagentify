import {
  ApplicationRef,
  EnvironmentInjector,
  createComponent,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { InspectorService } from './inspector.service.js';
import { BridgeService } from './bridge.service.js';
import { OverlayComponent } from './overlay/overlay.component.js';

export function provideNgAnnotate() {
  return makeEnvironmentProviders([
    InspectorService,
    BridgeService,
    provideAppInitializer(() => {
      if (!isDevMode()) return;
      const bridge = inject(BridgeService);
      const appRef = inject(ApplicationRef);
      const envInjector = inject(EnvironmentInjector);
      bridge.init();
      const overlayRef = createComponent(OverlayComponent, { environmentInjector: envInjector });
      appRef.attachView(overlayRef.hostView);
      document.body.appendChild(overlayRef.location.nativeElement);
    }),
  ]);
}
