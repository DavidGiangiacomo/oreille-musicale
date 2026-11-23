import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { journalSize } from './data';
import { getSyncStatus, loadSyncStatus, requestSync, subscribeSyncStatus } from './sync';

/** Délai après un changement local avant d'envoyer, pour grouper les réponses d'une série. */
const AFTER_CHANGE_MS = 5_000;
/** Lecture régulière des nouveautés des autres appareils, appli au premier plan. */
const PERIOD_MS = 5 * 60_000;

/**
 * Synchronisation automatique (§10.8) : au démarrage, peu après chaque
 * changement, au retour du réseau ou de l'appli, et régulièrement.
 */
export function SyncManager() {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const enabled = status.state !== 'off' && status.state !== 'loading';
  const size = useLiveQuery(journalSize, []);
  const lastSize = useRef<string | undefined>(undefined);

  useEffect(() => {
    void loadSyncStatus();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void requestSync();
    const sync = () => void requestSync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') sync();
    }, PERIOD_MS);
    return () => {
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [enabled]);

  useEffect(() => {
    const previous = lastSize.current;
    lastSize.current = size;
    if (!enabled || size === undefined || previous === undefined || previous === size) return;
    const timer = window.setTimeout(() => void requestSync(), AFTER_CHANGE_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, size]);

  return null;
}
