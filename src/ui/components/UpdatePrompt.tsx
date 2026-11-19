import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { primaryButton, secondaryButton } from '../styles';

/** Durée d'affichage du message « fonctionne sans connexion ». */
const OFFLINE_NOTICE_MS = 5000;

/**
 * Service worker de la version web (§10.6) : propose la nouvelle version quand elle
 * est prête, et signale brièvement que l'appli fonctionne désormais sans connexion.
 * Absent de l'application Android, qui embarque déjà tout.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), OFFLINE_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-xl flex-col gap-3 rounded-t-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
      >
        <p>Une nouvelle version de l'appli est prête.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={primaryButton}
            onClick={() => void updateServiceWorker(true)}
          >
            Mettre à jour
          </button>
          <button type="button" className={secondaryButton} onClick={() => setNeedRefresh(false)}>
            Plus tard
          </button>
        </div>
      </div>
    );
  }
  // Simple information : elle ne doit masquer ni bloquer aucun bouton.
  return (
    <p
      role="status"
      className={`pointer-events-none fixed inset-x-4 bottom-4 z-10 mx-auto max-w-sm rounded-xl bg-slate-900 px-4 py-3 text-center text-sm text-white shadow-lg transition-opacity dark:bg-slate-100 dark:text-slate-900 ${offlineReady ? 'opacity-100' : 'opacity-0'}`}
    >
      {offlineReady ? "L'appli fonctionne maintenant sans connexion." : ''}
    </p>
  );
}
