import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        // Serve the manifest + SW in `npm run dev` too. Without this, dev
        // serves no manifest at all, so an already-installed copy of the app
        // keeps showing its stale cached icon and you can't verify icon
        // changes without a full prod build.
        devOptions: {
          enabled: true,
          type: 'module',
        },
        manifest: {
          name: 'Backbone POS',
          short_name: 'Backbone POS',
          description: 'Point of sale for Backbone restaurant management',
          theme_color: '#0D6EFD',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
            },
          ],
        },
        workbox: {
          // Never cache or intercept Firebase/Google API traffic.
          // This app processes live payments — Firestore writes must always
          // reach the real server; stale cached responses are unacceptable.
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/[^/]+\.firebaseio\.com\//,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\//,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/[^/]+\.googleapis\.com\//,
              handler: 'NetworkOnly',
            },
          ],
          // Raised above the 2 MB default to accommodate the production bundle.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Pre-bundle these at startup. They're pulled in statically (via
    // pdfGenerator/receiptPrinter) but deep enough in the module graph that
    // Vite only discovers them mid-load, triggers a dep re-optimization,
    // serves 503s for the in-flight chunks, and leaves a blank screen until
    // a manual reload. Listing them here bundles everything before the first
    // request.
    optimizeDeps: {
      include: ['jspdf', 'jspdf-autotable'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
