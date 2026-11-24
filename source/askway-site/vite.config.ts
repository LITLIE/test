import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: process.env.SITE_BASE || '/',
  plugins: [react()],
  cacheDir: '.agent_cache/vite',
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    target: 'es2020', sourcemap: false,
    rollupOptions: { output: { manualChunks(id) { if (id.replace(/\\/g, '/').includes('/node_modules/three/')) return 'city-runtime'; } } },
  },
});
