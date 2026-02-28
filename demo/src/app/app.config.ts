import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideNgAnnotate } from '@ng-annotate/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideNgAnnotate(),
  ],
};
