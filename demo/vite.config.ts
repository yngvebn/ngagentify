import { defineConfig } from 'vite';
import { ngAnnotateMcp } from '@ng-annotate/vite-plugin';

export default defineConfig({
  plugins: [...ngAnnotateMcp()],
});
