/// <reference types="vite-plugin-pwa/react" />

/** Version de l'appli (package.json), injectée au build par Vite. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** « 1 » : moteur audio silencieux, pour les tests de bout en bout. */
  readonly VITE_FAKE_AUDIO?: string;
  /** Adresse du serveur de synchronisation, pour une instance auto-hébergée ou les tests. */
  readonly VITE_SYNC_URL?: string;
}
