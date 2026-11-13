/* Ce relais local n'est chargé QUE par docker-compose.ui-test.yml. La configuration Vite habituelle reste indépendante. */
import { readFileSync } from 'node:fs';
import { defineConfig, mergeConfig, type ProxyOptions } from 'vite';
import base from './vite.config';

if (process.env.NEON_UI_TEST !== '1') throw new Error('Configuration réservée au Docker de test d’interfaces.');
const runtimeFile = process.env.UI_TEST_SESSION_FILE || '/ui-runtime/session.json';
const proxy: ProxyOptions = {
  target: process.env.API_URL || 'http://api:8080',
  changeOrigin: false,
  configure(p) {
    p.on('proxyReq', (request) => {
      try {
        request.setHeader('cookie', JSON.parse(readFileSync(runtimeFile, 'utf8')).cookie);
      } catch {
        request.destroy(new Error('Session de démonstration non disponible.'));
      }
    });
    p.on('proxyRes', (response) => {
      delete response.headers['set-cookie'];
    });
  },
};
export default defineConfig(
  mergeConfig(base, {
    plugins: [
      {
        name: 'neon-interfaces-sans-passerelle',
        transformIndexHtml: (html: string) =>
          html.replace(/\s*<script defer src="\/update\/client\.js"><\/script>/, ''),
      },
    ],
    define: { 'import.meta.env.VITE_NEON_UI_TEST': JSON.stringify('true') },
    server: {
      port: Number(process.env.UI_TEST_PORT || '5173'),
      strictPort: true,
      fs: { deny: ['.env', '.env.*', '**/.git/**', '**/*session*.json', '**/ui-runtime/**', '**/ui-secrets/**'] },
      proxy: { '/api': proxy, '/d/': proxy, '/healthz': proxy },
    },
  }),
);
