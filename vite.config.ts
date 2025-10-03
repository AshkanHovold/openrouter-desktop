import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true // Fail fast if 5173 is taken so Electron + Vite stay in sync
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  }
}));
