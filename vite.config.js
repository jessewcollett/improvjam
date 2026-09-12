import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => (
              url.pathname.startsWith('/api/catalog')
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
});
