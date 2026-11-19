import { Dexie, type EntityTable } from 'dexie';
import type { Attempt, ProgressEvent, SessionRecord, Settings } from '../core/journal';

/** Ligne unique des réglages ; seuls les champs connus sont relus (normalizeSettings). */
export interface SettingsRow extends Partial<Settings> {
  id: 'settings';
}

export type OreilleDatabase = Dexie & {
  sessions: EntityTable<SessionRecord, 'id'>;
  attempts: EntityTable<Attempt, 'id'>;
  settings: EntityTable<SettingsRow, 'id'>;
  events: EntityTable<ProgressEvent, 'id'>;
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
