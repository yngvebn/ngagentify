import {
  NgModule,
  isDevMode,
  provideAppInitializer,
  inject,
  ApplicationRef,
  EnvironmentInjector,
  createComponent,
} from '@angular/core';
import { InspectorService } from './inspector.service';
import { BridgeService } from './bridge.service';
import { OverlayComponent } from './overlay/overlay.component';

@NgModule({
  providers: isDevMode()
    ? [
        InspectorService,
        BridgeService,
        provideAppInitializer(() => {
          const bridge = inject(BridgeService);
          const appRef = inject(ApplicationRef);
          const envInjector = inject(EnvironmentInjector);
          bridge.init();
          const overlayRef = createComponent(OverlayComponent, { environmentInjector: envInjector });
          appRef.attachView(overlayRef.hostView);
          document.body.appendChild(overlayRef.location.nativeElement);
        }),
      ]
    : [],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- required by NgModule pattern
export class NgAnnotateModule {}
