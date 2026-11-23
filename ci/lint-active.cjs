'use strict';

const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const projectRequire = createRequire(path.resolve('package.json'));
const { buildSync } = projectRequire('esbuild');

// Include every source module reachable from this app's Vite entry, including lazy imports.
const result = buildSync({
  entryPoints: ['src/main.tsx'], bundle: true, packages: 'external', format: 'esm', write: false,
  outdir: 'out', metafile: true, logLevel: 'silent',
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.woff2': 'dataurl' }
});
if (result.warnings.length) {
  console.error('Cannot determine the active lint scope reliably:', result.warnings);
  process.exit(1);
}
const files = Object.keys(result.metafile.inputs)
  .map(file => file.replace(/\\/g, '/'))
  .filter(file => file.startsWith('src/') && /\.(?:[cm]?js|jsx|tsx?)$/.test(file));
if (!files.includes('src/main.tsx') || !files.includes('src/App.tsx')) {
  throw new Error('The active entrypoint was not resolved; refusing to skip lint.');
}
console.log(`Linting ${files.length} reachable source modules.`);
const eslint = path.join(path.dirname(projectRequire.resolve('eslint/package.json')), 'bin/eslint.js');
const run = spawnSync(process.execPath, [eslint, ...files, '--report-unused-disable-directives'], { stdio: 'inherit' });
if (run.error) throw run.error;
process.exit(run.status ?? 1);
