import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = process.env.API_URL || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['source'] },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Aucun script en ligne : la CSP « script-src 'self' » reste stricte.
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: api, changeOrigin: false },
      '/d/': { target: api, changeOrigin: false },
      '/healthz': { target: api, changeOrigin: false },
    },
  },
});
