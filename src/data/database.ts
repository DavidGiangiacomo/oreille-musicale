import { Dexie, type EntityTable } from 'dexie';
import type { Attempt, ProgressEvent, SessionRecord, Settings } from '../core/journal';
import type { SettingChange } from '../core/sync/records';

/** Ligne unique des réglages ; seuls les champs connus sont relus (normalizeSettings). */
export interface SettingsRow extends Partial<Settings> {
  id: 'settings';
}

/** Modification d'un réglage partagé, gardée pour la fusion entre appareils (§10.8). */
export interface SettingChangeRow extends SettingChange {
  key: string;
}

/** Valeurs propres à la synchronisation : appareil, clé, position de lecture. */
export interface SyncMetaRow {
  key: 'device' | 'syncKey' | 'cursor' | 'lastSyncAt';
  value: string | number;
}

/** Enregistrement reçu d'une version plus récente de l'appli, à relire après mise à jour. */
export interface DeferredRow {
  id: string;
  data: string;
}

export type OreilleDatabase = Dexie & {
  sessions: EntityTable<SessionRecord, 'id'>;
  attempts: EntityTable<Attempt, 'id'>;
  settings: EntityTable<SettingsRow, 'id'>;
  events: EntityTable<ProgressEvent, 'id'>;
  settingChanges: EntityTable<SettingChangeRow, 'key'>;
  /** Clés des enregistrements déjà présents sur le serveur. */
  syncedKeys: EntityTable<{ key: string }, 'key'>;
  syncMeta: EntityTable<SyncMetaRow, 'key'>;
  syncDeferred: EntityTable<DeferredRow, 'id'>;
};

/**
 * Schéma de la base, par version. Toute modification passe par une nouvelle
 * version (avec sa fonction de migration si besoin), jamais par une retouche
 * d'une version publiée : les données des utilisateurs en dépendent.
 */
export const SCHEMA_VERSIONS = [
  {
    version: 1,
    stores: {
      sessions: 'id, startedAt',
      attempts: 'id, sessionId, at, competenceId',
      settings: 'id',
    },
  },
  {
    // J2 : événements de progression, et réponses retrouvées par étape.
    version: 2,
    stores: {
      sessions: 'id, startedAt',
      attempts: 'id, sessionId, at, competenceId, stepId',
      settings: 'id',
      events: 'id, at, stepId, type',
    },
  },
  {
    // v2 de l'appli : synchronisation entre appareils (§10.8).
    version: 3,
    stores: {
      sessions: 'id, startedAt',
      attempts: 'id, sessionId, at, competenceId, stepId',
      settings: 'id',
      events: 'id, at, stepId, type',
      settingChanges: 'key, field',
      syncedKeys: 'key',
      syncMeta: 'key',
      syncDeferred: 'id',
    },
  },
] as const;

export const DATABASE_NAME = 'oreille-musicale';

/**
 * Ouvre la base. `upToVersion` ne sert qu'aux tests de migration, pour simuler
 * une ancienne version de l'appli.
 */
export function openDatabase(
  name: string = DATABASE_NAME,
  upToVersion: number = Infinity,
): OreilleDatabase {
  const db = new Dexie(name) as OreilleDatabase;
  for (const { version, stores } of SCHEMA_VERSIONS) {
    if (version <= upToVersion) db.version(version).stores(stores);
  }
  return db;
}
