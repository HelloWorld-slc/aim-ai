import { build } from 'esbuild';
import { writeLicenses } from './scripts/licenses.mjs';
const extension = await build({ entryPoints: ['src/extension.ts'], bundle: true, outfile: 'dist/extension.js', external: ['vscode'], platform: 'node', target: 'node20', format: 'cjs', sourcemap: true, metafile: true });
const webview = await build({ entryPoints: ['media/main.js'], bundle: true, outfile: 'media/webview.js', platform: 'browser', target: 'es2022', format: 'iife', minify: true, metafile: true });
await writeLicenses([extension.metafile, webview.metafile]);
