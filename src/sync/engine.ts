// Moteur de synchronisation (docs/DESIGN.md §10.8) : envoie ce que le serveur n'a
// pas, puis lit ce qui est arrivé depuis la dernière fois. Il ne dépend ni du
// serveur (un `SyncTransport`) ni de la base (un `SyncStore`).
import { envelope, parseEnvelope, recordKey, type SyncRecord } from '../core/sync/records';
import { seal, unseal, type SealedRecord, type SyncKeys } from './crypto';

/** Serveur injoignable (pas de réseau, coupure) : la synchronisation reprendra plus tard. */
export class SyncUnreachable extends Error {}

/** Enregistrement lu sur le serveur, avec sa position dans le dossier. */
export interface StoredRecord extends SealedRecord {
  seq: number;
}

/**
 * Accès au dossier du serveur. Le serveur ne fait que garder des blocs chiffrés :
 * un identifiant déjà connu est ignoré, et chaque nouveau bloc reçoit un numéro
 * croissant (`seq`) pour la lecture incrémentale.
 */
export interface SyncTransport {
  push(records: readonly SealedRecord[]): Promise<void>;
  pull(after: number, limit: number): Promise<{ records: StoredRecord[]; more: boolean }>;
}

/** Ce dont le moteur a besoin côté appareil (implémenté sur la base dans data/sync.ts). */
export interface SyncStore {
  pending(): Promise<SyncRecord[]>;
  markSynced(keys: readonly string[]): Promise<void>;
  applyRemote(records: readonly SyncRecord[]): Promise<void>;
  cursor(): Promise<number>;
  setCursor(cursor: number): Promise<void>;
  deferred(): Promise<SealedRecord[]>;
  defer(records: readonly SealedRecord[]): Promise<void>;
  undefer(ids: readonly string[]): Promise<void>;
}

export interface SyncReport {
  sent: number;
  received: number;
  /** Enregistrements d'une version plus récente de l'appli, gardés pour plus tard. */
  deferred: number;
  /** Enregistrements illisibles (abîmés, ou chiffrés avec une autre clé), ignorés. */
  rejected: number;
}

/** Lot d'envoi et page de lecture ; au plus MAX_PUSH_RECORDS (sync/protocol.ts). */
export const BATCH_SIZE = 200;

async function decode(keys: SyncKeys, sealed: SealedRecord) {
  const content = await unseal(keys, sealed);
  return content === null ? ({ ok: false, reason: 'invalid' } as const) : parseEnvelope(content);
}

/**
 * Une synchronisation complète. En cas de coupure, elle s'arrête sur une erreur :
 * ce qui a été envoyé ou reçu avant reste acquis, et la suivante reprend là.
 */
export async function synchronize(
  keys: SyncKeys,
  store: SyncStore,
  transport: SyncTransport,
): Promise<SyncReport> {
  const report: SyncReport = { sent: 0, received: 0, deferred: 0, rejected: 0 };

  // 1. Ce qui avait été mis de côté se lit peut-être avec cette version de l'appli.
  const waiting = await store.deferred();
  const readable: SyncRecord[] = [];
  const done: string[] = [];
  for (const sealed of waiting) {
    const parsed = await decode(keys, sealed);
    if (parsed.ok) readable.push(parsed.record);
    if (parsed.ok || parsed.reason === 'invalid') done.push(sealed.id);
  }
  await store.applyRemote(readable);
  await store.undefer(done);
  report.received += readable.length;

  // 2. Envoi de ce que le serveur n'a pas encore, par lots.
  const pending = await store.pending();
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const keyed = batch.map((record) => ({ record, key: recordKey(record) }));
    const sealed = await Promise.all(
      keyed.map(({ record, key }) => seal(keys, key, envelope(record))),
    );
    await transport.push(sealed);
    await store.markSynced(keyed.map(({ key }) => key));
    report.sent += batch.length;
  }

  // 3. Lecture de ce qui est arrivé depuis la dernière fois, par pages.
  let cursor = await store.cursor();
  for (;;) {
    const page = await transport.pull(cursor, BATCH_SIZE);
    const records: SyncRecord[] = [];
    const later: SealedRecord[] = [];
    for (const stored of page.records) {
      const parsed = await decode(keys, stored);
      if (parsed.ok) records.push(parsed.record);
      else if (parsed.reason === 'newer') later.push({ id: stored.id, data: stored.data });
      else report.rejected += 1;
    }
    await store.applyRemote(records);
    await store.defer(later);
    report.received += records.length;
    report.deferred += later.length;
    const last = page.records.at(-1);
    if (last) {
      cursor = last.seq;
      await store.setCursor(cursor);
    }
    if (!page.more || !last) break;
  }
  return report;
}
