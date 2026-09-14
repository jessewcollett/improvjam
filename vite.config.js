import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import catalogHandler from './api/catalog.js';
import mediaHandler from './api/media.js';
import stageHandler from './api/stage.js';

function vercelAdapter(handler, prefix) {
  return async (req, res, next) => {
    const path = (req.url || '').split('?')[0];
    if (path !== prefix && !path.startsWith(`${prefix}/`)) {
      next();
      return;
    }
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || prefix, `http://${host}`);
    req.query = Object.fromEntries(url.searchParams.entries());
    const verd = {
      statusCode: 200,
      setHeader(key, value) {
        res.setHeader(key, value);
      },
      status(code) {
        this.statusCode = code;
        res.statusCode = code;
        return this;
      },
      json(payload) {
        res.statusCode = this.statusCode || 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload));
      },
      send(body) {
        res.statusCode = this.statusCode || 200;
        if (Buffer.isBuffer(body) || typeof body === 'string') {
          res.end(body);
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(body));
      },
      end() {
        res.end();
      },
    };
    try {
      await handler(req, verd);
    } catch (error) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(error.message || 'API error');
      }
    }
  };
}

function localApis() {
  return {
    name: 'local-vercel-apis',
    configureServer(server) {
      server.middlewares.use(vercelAdapter(catalogHandler, '/api/catalog'));
      server.middlewares.use(vercelAdapter(mediaHandler, '/api/media'));
      server.middlewares.use(vercelAdapter(stageHandler, '/api/stage'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.VITE_SHEETS_URL && !process.env.VITE_SHEETS_URL) {
    process.env.VITE_SHEETS_URL = env.VITE_SHEETS_URL;
  }

  return {
    plugins: [
      react(),
      localApis(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'sounds/counter-bell.mp3', 'sounds/ringing-bell.mp3'],
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => (
                url.pathname.startsWith('/api/catalog')
                || url.pathname.startsWith('/api/media')
                || url.pathname.startsWith('/api/stage')
                || url.hostname.includes('script.google.com')
                || url.hostname.includes('script.googleusercontent.com')
              ),
              handler: 'NetworkOnly',
            },
          ],
        },
        manifest: {
          name: 'Improv Jam',
          short_name: 'Improv Jam',
          description: 'Game library, glossary, and prompt generator for improv rehearsals.',
          theme_color: '#121212',
          background_color: '#121212',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
      }),
    ],
  };
});
