import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const outDir = 'dist-electron';
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ['src/main/main.ts', 'src/main/preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outdir: outDir,
  sourcemap: true,
  external: ['electron'],
  outExtension: { '.js': '.cjs' },
});

// Copy package.json minimal for production (optional) - skipping for now
const staticAssets = [];
for (const asset of staticAssets) {
  await cp(asset, path.join(outDir, path.basename(asset)), { recursive: true });
}

console.log('Electron build complete.');
