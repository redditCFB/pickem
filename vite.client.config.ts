import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { localClientApi } from './tools/localClientApi';

/**
 * Browser dev server for the React UI. The Devvit Vite plugin only supports
 * `vite build`, so playtest keeps using vite.config.ts.
 */
const devvitClientStub = fileURLToPath(
  new URL('./tools/devvitClientStub.ts', import.meta.url)
);

export default defineConfig({
  root: 'src/client',
  plugins: [react(), tailwind(), localClientApi()],
  resolve: {
    alias: {
      '@devvit/web/client': devvitClientStub,
    },
  },
  server: {
    port: 7474,
    open: '/game.html',
  },
});
