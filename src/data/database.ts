import { Dexie, type EntityTable } from 'dexie';
import type { Attempt, SessionRecord, Settings } from '../core/journal';

/** Ligne unique des réglages ; seuls les champs connus sont relus (normalizeSettings). */
export interface SettingsRow extends Partial<Settings> {
  id: 'settings';
}

export type OreilleDatabase = Dexie & {
  sessions: EntityTable<SessionRecord, 'id'>;
  attempts: EntityTable<Attempt, 'id'>;
  settings: EntityTable<SettingsRow, 'id'>;
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
] as const;

export const DATABASE_NAME = 'oreille-musicale';

export function openDatabase(name: string = DATABASE_NAME): OreilleDatabase {
  const db = new Dexie(name) as OreilleDatabase;
  for (const { version, stores } of SCHEMA_VERSIONS) {
    db.version(version).stores(stores);
  }
  return db;
}
