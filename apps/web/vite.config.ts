import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Where the dev server and `vite preview` forward /api. On the host the API is on
// localhost; in a container `localhost` is the web container itself, so compose sets
// this to http://api:3000. `||` not `??` — an empty value should fall back to the
// default rather than resolve to an unusable empty target.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    allowedHosts: ['daleelex.com'],
    proxy: {
      '/api': API_PROXY_TARGET,
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': API_PROXY_TARGET,
    },
  },
});
