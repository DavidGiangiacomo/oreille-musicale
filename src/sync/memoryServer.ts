// Serveur de synchronisation en mémoire, au comportement du vrai (docs/DESIGN.md
// §10.8) : pour les tests, et comme référence du protocole.
import type { SealedRecord } from './crypto';
import type { StoredRecord, SyncTransport } from './engine';

interface Bucket {
  token: string;
  seq: number;
  ids: Set<string>;
  records: StoredRecord[];
}

export class SyncAccessDenied extends Error {}
export class SyncOffline extends Error {}

export class MemorySyncServer {
  readonly #buckets = new Map<string, Bucket>();

  /** Le dossier est créé au premier accès, avec ce jeton ; un autre jeton est refusé. */
  #bucket(bucket: string, token: string): Bucket {
    let found = this.#buckets.get(bucket);
    if (!found) {
      found = { token, seq: 0, ids: new Set(), records: [] };
      this.#buckets.set(bucket, found);
    }
    if (found.token !== token) throw new SyncAccessDenied('Jeton refusé');
    return found;
  }

  /** Nombre de blocs gardés pour un dossier (tests). */
  size(bucket: string): number {
    return this.#buckets.get(bucket)?.records.length ?? 0;
  }

  /** Accès d'un appareil ; `online()` dit à chaque appel si le réseau passe. */
  transport(bucket: string, token: string, online: () => boolean = () => true): SyncTransport {
    const check = () => {
      if (!online()) throw new SyncOffline('Hors ligne');
    };
    return {
      push: async (records: readonly SealedRecord[]) => {
        check();
        const target = this.#bucket(bucket, token);
        for (const { id, data } of records) {
          if (target.ids.has(id)) continue;
          target.ids.add(id);
          target.seq += 1;
          target.records.push({ id, data, seq: target.seq });
        }
        await Promise.resolve();
      },
      pull: async (after: number, limit: number) => {
        check();
        const target = this.#bucket(bucket, token);
        const next = target.records.filter((record) => record.seq > after);
        await Promise.resolve();
        return { records: next.slice(0, limit), more: next.length > limit };
      },
    };
  }
}
