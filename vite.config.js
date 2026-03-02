import { defineConfig } from 'vite';

export default defineConfig({
  // Expose all VITE_ prefixed env vars to the client
  envPrefix: 'VITE_',
  define: {
    __VERSION__: JSON.stringify('0.1.1'),
  },
  server: {
    port: 5173,
    open: true,
  },
});
