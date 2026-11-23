// Côté base de données de la synchronisation (docs/DESIGN.md §10.8) : ce qui reste
// à envoyer, la fusion de ce qui arrive, et l'état propre à l'appareil.
import { normalizeSettings } from '../core/journal';
import { allSettingChanges, mergeSession, resolveSettings } from '../core/sync/merge';
import { recordKey, type SettingChange, type SyncRecord } from '../core/sync/records';
import type { DeferredRow, OreilleDatabase, SettingChangeRow } from './database';

export const settingChangeKey = (change: SettingChange) =>
  `${change.field}:${change.at}:${change.device}`;

export const settingChangeRow = (change: SettingChange): SettingChangeRow => ({
  ...change,
  key: settingChangeKey(change),
});

const withoutKey = (row: SettingChangeRow): SettingChange => ({
  field: row.field,
  value: row.value,
  at: row.at,
  device: row.device,
});

/** Identifiant de cet appareil, créé à la première demande. */
export async function deviceId(db: OreilleDatabase): Promise<string> {
  return db.transaction('rw', db.syncMeta, async () => {
    const row = await db.syncMeta.get('device');
    if (typeof row?.value === 'string') return row.value;
    const id = crypto.randomUUID();
    await db.syncMeta.put({ key: 'device', value: id });
    return id;
  });
}

/**
 * Horodatage d'une modification de réglages : l'heure, mais toujours après la
 * précédente modification connue, pour que deux enregistrements rapprochés aient
 * des clés distinctes. À appeler dans une transaction sur `settingChanges`.
 */
export async function nextStamp(db: OreilleDatabase): Promise<number> {
  const last = (await db.settingChanges.toArray()).reduce((max, row) => Math.max(max, row.at), 0);
  return Math.max(Date.now(), last + 1);
}

/** Tables touchées par la fusion d'enregistrements reçus. */
const mergeTables = (db: OreilleDatabase) => [
  db.sessions,
  db.attempts,
  db.events,
  db.settings,
  db.settingChanges,
  db.syncedKeys,
];

export function createSyncStore(db: OreilleDatabase) {
  return {
    deviceId: () => deviceId(db),

    /** Clé de synchronisation enregistrée sur cet appareil, ou null si elle est désactivée. */
    async syncKey(): Promise<string | null> {
      const row = await db.syncMeta.get('syncKey');
      return typeof row?.value === 'string' ? row.value : null;
    },

    /**
     * Active la synchronisation avec cette clé. L'appareil qui crée la clé partage
     * tous ses réglages (`shareSettings`) ; celui qui la rejoint prend ceux des autres.
     */
    async enable(syncKey: string, shareSettings: boolean): Promise<void> {
      const device = await deviceId(db);
      await db.transaction('rw', [db.syncMeta, db.settings, db.settingChanges], async () => {
        await db.syncMeta.put({ key: 'syncKey', value: syncKey });
        await db.syncMeta.put({ key: 'cursor', value: 0 });
        if (shareSettings) {
          const settings = normalizeSettings(await db.settings.get('settings'));
          await db.settingChanges.bulkPut(
            allSettingChanges(settings, await nextStamp(db), device).map(settingChangeRow),
          );
        }
      });
    },

    /** Désactive la synchronisation ; les données de l'appareil restent. */
    async disable(): Promise<void> {
      await db.transaction('rw', [db.syncMeta, db.syncedKeys, db.syncDeferred], async () => {
        await Promise.all([
          db.syncMeta.delete('syncKey'),
          db.syncMeta.delete('cursor'),
          db.syncedKeys.clear(),
          db.syncDeferred.clear(),
        ]);
      });
    },

    /** Position de lecture dans le dossier du serveur. */
    async cursor(): Promise<number> {
      const row = await db.syncMeta.get('cursor');
      return typeof row?.value === 'number' ? row.value : 0;
    },

    async setCursor(cursor: number): Promise<void> {
      await db.syncMeta.put({ key: 'cursor', value: cursor });
    },

    /** Enregistrements de l'appareil que le serveur n'a pas encore. */
    async pending(): Promise<SyncRecord[]> {
      return db.transaction(
        'r',
        [db.sessions, db.attempts, db.events, db.settingChanges, db.syncedKeys],
        async () => {
          const [sessions, attempts, events, changes, synced] = await Promise.all([
            db.sessions.toArray(),
            db.attempts.toArray(),
            db.events.toArray(),
            db.settingChanges.toArray(),
            db.syncedKeys.toCollection().primaryKeys(),
          ]);
          const known = new Set(synced);
          const records: SyncRecord[] = [
            ...sessions.map((value): SyncRecord => ({ kind: 'session', value })),
            ...attempts.map((value): SyncRecord => ({ kind: 'attempt', value })),
            ...events.map((value): SyncRecord => ({ kind: 'event', value })),
            ...changes.map((row): SyncRecord => ({ kind: 'setting', value: withoutKey(row) })),
          ];
          return records.filter((record) => !known.has(recordKey(record)));
        },
      );
    },

    async markSynced(keys: readonly string[]): Promise<void> {
      await db.syncedKeys.bulkPut(keys.map((key) => ({ key })));
    },

    /**
     * Fusionne des enregistrements reçus, en une transaction : union des séances,
     * réponses et événements ; réglages recalculés à partir de toutes les
     * modifications connues. Les projections (étapes, révisions…) se recalculent
     * d'elles-mêmes à partir du journal.
     */
    async applyRemote(records: readonly SyncRecord[]): Promise<void> {
      if (records.length === 0) return;
      await db.transaction('rw', mergeTables(db), async () => {
        for (const record of records) {
          switch (record.kind) {
            case 'session': {
              const merged = mergeSession(await db.sessions.get(record.value.id), record.value);
              if (merged) await db.sessions.put(merged);
              break;
            }
            case 'attempt':
              if (!(await db.attempts.get(record.value.id))) await db.attempts.add(record.value);
              break;
            case 'event':
              if (!(await db.events.get(record.value.id))) await db.events.add(record.value);
              break;
            case 'setting':
              await db.settingChanges.put(settingChangeRow(record.value));
              break;
          }
        }
        if (records.some((record) => record.kind === 'setting')) {
          const current = normalizeSettings(await db.settings.get('settings'));
          const changes = (await db.settingChanges.toArray()).map(withoutKey);
          const resolved = resolveSettings(current, changes);
          if (resolved !== current) await db.settings.put({ ...resolved, id: 'settings' });
        }
        await db.syncedKeys.bulkPut(records.map((record) => ({ key: recordKey(record) })));
      });
    },

    /** Enregistrements d'une version plus récente, gardés pour plus tard. */
    deferred: (): Promise<DeferredRow[]> => db.syncDeferred.toArray(),

    async defer(rows: readonly DeferredRow[]): Promise<void> {
      await db.syncDeferred.bulkPut([...rows]);
    },

    async undefer(ids: readonly string[]): Promise<void> {
      await db.syncDeferred.bulkDelete([...ids]);
    },
  };
}

export type SyncStore = ReturnType<typeof createSyncStore>;
