import { defineConfig } from 'vite';
import { ngAnnotateMcp } from 'ng-annotate-mcp';

export default defineConfig({
  plugins: [...ngAnnotateMcp()],
});
