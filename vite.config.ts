import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Appli installable qui fonctionne hors-ligne (docs/DESIGN.md §10.6) : l'appli est
    // mise en cache à la première visite, les échantillons à leur première écoute.
    // Une nouvelle version attend l'accord de l'utilisateur (registerType « prompt »).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Oreille musicale',
        short_name: 'Oreille',
        description: 'Entraînez votre oreille musicale : intervalles, accords, gammes et modes.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Les échantillons (≈ 2 Mo) ne sont pas précachés : ils le sont à la première écoute.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['samples/**'],
        cleanupOutdatedCaches: true,
        // Première visite : le service worker prend tout de suite la main, pour mettre
        // en cache les échantillons dès la première écoute. Les mises à jour, elles,
        // attendent l'accord de l'utilisateur.
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/samples/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'echantillons',
              expiration: { maxEntries: 120 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // Chemins relatifs : la même construction fonctionne sous /oreille-musicale/ sur
  // GitHub Pages et à la racine dans l'application Android (Capacitor). Le routage
  // par « # » évite d'avoir besoin de réécritures côté serveur.
  base: './',
  build: {
    // Le budget du document de conception (§10.10) porte sur la taille compressée :
    // 250 Ko au plus pour le JavaScript initial. Ce seuil, avant compression, n'est
    // qu'une alerte précoce.
    chunkSizeWarningLimit: 700,
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
