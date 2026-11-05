import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), {
    name: 'local-canonical-page-urls',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!['GET','HEAD'].includes(req.method) || !(req.headers.accept||'').includes('text/html')) return next();
        const url = new URL(req.url, 'http://127.0.0.1');
        if (/^\/(?:api|cms|@|src|node_modules|tests)(?:\/|$)/.test(url.pathname)) return next();
        try {
          const response = await fetch('http://127.0.0.1:8011/api/page-route?path='+encodeURIComponent(url.pathname), {signal:AbortSignal.timeout(3000)});
          if (response.ok) {
            const route = await response.json();
            if (route.redirect && /^\/(?!\/)/.test(route.url_path)) {
              res.writeHead(301, {Location:route.url_path+url.search}); res.end(); return;
            }
          }
        } catch { /* The frontend displays its regular API error if PHP is unavailable. */ }
        next();
      });
    }
  }],
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
