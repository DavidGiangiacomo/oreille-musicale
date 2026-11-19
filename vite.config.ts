import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Chemins relatifs : la même construction fonctionne sous /oreille-musicale/ sur
  // GitHub Pages et à la racine dans l'application Android (Capacitor). Le routage
  // par « # » évite d'avoir besoin de réécritures côté serveur.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
