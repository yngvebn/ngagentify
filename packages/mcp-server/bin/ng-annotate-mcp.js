#!/usr/bin/env node
// Entry point for the ng-annotate-mcp binary.
// The shebang above causes npm to generate a correct Windows .cmd shim
// that prepends `node`, rather than trying to run the .js file directly.
import('../dist/index.js').catch(err => {
  process.stderr.write('[ng-annotate-mcp] Fatal: ' + String(err) + '\n');
  process.exit(1);
});
