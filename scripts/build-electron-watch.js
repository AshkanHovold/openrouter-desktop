import { context } from 'esbuild';
import { mkdir } from 'node:fs/promises';

const outDir = 'dist-electron';
await mkdir(outDir, { recursive: true });

const ctx = await context({
  entryPoints: ['src/main/main.ts', 'src/main/preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outdir: outDir,
  sourcemap: true,
  external: ['electron'],
  outExtension: { '.js': '.cjs' },
  logLevel: 'info'
});

await ctx.watch();
console.log('Electron build (watch) started');
