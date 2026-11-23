// Synchronisation entre appareils, côté interface (docs/DESIGN.md §10.8) : état
// partagé par les écrans, et une synchronisation à la fois.
import {
  decodeSyncKey,
  deriveSyncKeys,
  encodeSyncKey,
  generateSecret,
  type SyncKeys,
} from '../sync/crypto';
import { synchronize, SyncUnreachable } from '../sync/engine';
import {
  deleteRemote,
  httpTransport,
  SyncServerError,
  type ServerAccess,
} from '../sync/httpTransport';
import { syncStore } from './data';

/** Serveur de synchronisation du projet ; une instance auto-hébergée se règle au build. */
export const SYNC_URL =
  import.meta.env.VITE_SYNC_URL || 'https://oreille-musicale-sync.david-giangiacomo.workers.dev';

export type SyncStatus =
  | { state: 'loading' }
  | { state: 'off' }
  | { state: 'idle' | 'syncing' | 'offline'; lastSyncAt: number | null }
  | { state: 'error'; lastSyncAt: number | null; message: string };

let status: SyncStatus = { state: 'loading' };
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSyncStatus = (): SyncStatus => status;

const lastOf = (current: SyncStatus) => ('lastSyncAt' in current ? current.lastSyncAt : null);

let cached: { syncKey: string; keys: SyncKeys } | null = null;

async function keysOf(syncKey: string): Promise<SyncKeys | null> {
  if (cached?.syncKey === syncKey) return cached.keys;
  const secret = decodeSyncKey(syncKey);
  if (!secret) return null;
  cached = { syncKey, keys: await deriveSyncKeys(secret) };
  return cached.keys;
}

const accessOf = (keys: SyncKeys): ServerAccess => ({
  url: SYNC_URL,
  bucket: keys.bucket,
  token: keys.token,
});

/** Lit l'état enregistré, au démarrage de l'appli. */
export async function loadSyncStatus(): Promise<void> {
  const syncKey = await syncStore.syncKey();
  setStatus(
    syncKey ? { state: 'idle', lastSyncAt: await syncStore.lastSyncAt() } : { state: 'off' },
  );
}

let running: Promise<void> | null = null;
let again = false;

async function runOnce(): Promise<void> {
  const syncKey = await syncStore.syncKey();
  if (!syncKey) {
    setStatus({ state: 'off' });
    return;
  }
  const lastSyncAt = lastOf(status);
  const keys = await keysOf(syncKey);
  if (!keys) {
    setStatus({ state: 'error', lastSyncAt, message: 'La clé enregistrée est illisible.' });
    return;
  }
  setStatus({ state: 'syncing', lastSyncAt });
  try {
    await synchronize(keys, syncStore, httpTransport(accessOf(keys)));
    const at = Date.now();
    await syncStore.setLastSyncAt(at);
    setStatus({ state: 'idle', lastSyncAt: at });
  } catch (error) {
    if (error instanceof SyncUnreachable) {
      setStatus({ state: 'offline', lastSyncAt });
    } else if (error instanceof SyncServerError && error.status === 403) {
      setStatus({ state: 'error', lastSyncAt, message: 'Le serveur refuse cette clé.' });
    } else if (error instanceof SyncServerError && error.status === 413) {
      setStatus({ state: 'error', lastSyncAt, message: 'L’espace de synchronisation est plein.' });
    } else {
      console.error('Synchronisation impossible', error);
      setStatus({
        state: 'error',
        lastSyncAt,
        message: 'La synchronisation a échoué ; elle sera retentée.',
      });
    }
  }
}

/**
 * Lance une synchronisation, ou en programme une autre juste après celle en cours :
 * des demandes rapprochées n'en font jamais tourner deux à la fois.
 */
export function requestSync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Premier appareil : crée une clé, partage ses réglages, et envoie tout. */
export async function createSyncKey(): Promise<string> {
  const syncKey = encodeSyncKey(generateSecret());
  await syncStore.enable(syncKey, true);
  setStatus({ state: 'idle', lastSyncAt: null });
  void requestSync();
  return syncKey;
}

/** Autre appareil : rejoint une clé existante. Faux si la clé est mal recopiée. */
export async function joinSyncKey(text: string): Promise<boolean> {
  const secret = decodeSyncKey(text);
  if (!secret) return false;
  await syncStore.enable(encodeSyncKey(secret), false);
  setStatus({ state: 'idle', lastSyncAt: null });
  void requestSync();
  return true;
}

/** Arrête la synchronisation sur cet appareil ; ses données restent. */
export async function disableSync(): Promise<void> {
  await running;
  await syncStore.disable();
  cached = null;
  setStatus({ state: 'off' });
}

/** Efface le dossier sur le serveur, puis arrête la synchronisation sur cet appareil. */
export async function deleteServerData(): Promise<void> {
  const syncKey = await syncStore.syncKey();
  const keys = syncKey ? await keysOf(syncKey) : null;
  if (keys) await deleteRemote(accessOf(keys));
  await disableSync();
}

/** La clé de cet appareil, pour en relier un autre. */
export const currentSyncKey = () => syncStore.syncKey();
