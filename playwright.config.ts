import { defineConfig, devices } from '@playwright/test';

// Tests de bout en bout (docs/DESIGN.md §10.10) : serveur de développement avec un
// moteur audio silencieux, horloge simulée dans chaque test.
const PORT = 5199;
export const PREVIEW_PORT = 5200;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 90_000,
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${PORT}/`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `npx vite --port ${PORT} --strictPort`,
      // Son silencieux, et serveur de synchronisation simulé par les tests (e2e/synchronisation).
      env: { VITE_FAKE_AUDIO: '1', VITE_SYNC_URL: 'https://sync.test' },
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Version construite, avec son service worker : pour le fonctionnement hors-ligne.
      command: `npm run build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
