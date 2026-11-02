import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  server: {
    host: '127.0.0.1',
    port: 3011,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8011',
        changeOrigin: true
      }
    }
  }
});
