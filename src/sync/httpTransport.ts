// Accès au serveur de synchronisation par HTTP (protocole : sync/protocol.ts).
import { SyncUnreachable, type StoredRecord, type SyncTransport } from './engine';
import type { SealedRecord } from './crypto';
import { bucketPath, recordsPath, type PullResponse, type PushBody } from './protocol';

/** Réponse d'erreur du serveur : 403 (jeton refusé), 413 (dossier plein), 5xx… */
export class SyncServerError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Le serveur de synchronisation a répondu ${status}`);
    this.status = status;
  }
}

export interface ServerAccess {
  /** Adresse du serveur, sans barre finale : « https://sync.example.org ». */
  url: string;
  bucket: string;
  token: string;
}

async function request(
  access: ServerAccess,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(`${access.url.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${access.token}` },
    });
  } catch (error) {
    // Pas de réseau, serveur injoignable : on réessaiera plus tard.
    throw new SyncUnreachable(error instanceof Error ? error.message : 'Réseau indisponible');
  }
  if (!response.ok) throw new SyncServerError(response.status);
  return response;
}

export function httpTransport(
  access: ServerAccess,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): SyncTransport {
  return {
    async push(records: readonly SealedRecord[]) {
      const body: PushBody = { records: records.map(({ id, data }) => ({ id, data })) };
      await request(
        access,
        recordsPath(access.bucket),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        fetchImpl,
      );
    },
    async pull(after: number, limit: number) {
      const query = `?after=${after}&limit=${limit}`;
      const response = await request(
        access,
        `${recordsPath(access.bucket)}${query}`,
        { method: 'GET' },
        fetchImpl,
      );
      const body = (await response.json()) as PullResponse;
      const records: StoredRecord[] = body.records.map(({ seq, id, data }) => ({ seq, id, data }));
      return { records, more: body.more };
    },
  };
}

/** Efface le dossier et tout son contenu sur le serveur. */
export async function deleteRemote(
  access: ServerAccess,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<void> {
  await request(access, bucketPath(access.bucket), { method: 'DELETE' }, fetchImpl);
}
