import {
  normalizeSettings,
  type Attempt,
  type ProgressEvent,
  type SessionRecord,
  type Settings,
} from '../core/journal';
import type { BackupData } from '../core/backup';
import { settingChanges } from '../core/sync/merge';
import type { OreilleDatabase } from './database';
import { deviceId, nextStamp, settingChangeRow } from './sync';

export interface SessionSummary {
  session: SessionRecord;
  total: number;
  correct: number;
}

/** Accès au journal et aux réglages enregistrés dans la base. */
export function createJournal(db: OreilleDatabase) {
  return {
    async startSession(session: SessionRecord): Promise<void> {
      await db.sessions.add(session);
    },

    async endSession(id: string, endedAt: number): Promise<void> {
      await db.sessions.update(id, { endedAt });
    },

    async addAttempt(attempt: Attempt): Promise<void> {
      await db.attempts.add(attempt);
    },

    async addEvent(event: ProgressEvent): Promise<void> {
      await db.events.add(event);
    },

    async attemptsOf(sessionId: string): Promise<Attempt[]> {
      return db.attempts.where('sessionId').equals(sessionId).sortBy('at');
    },

    /** Tous les événements de progression, du plus ancien au plus récent. */
    async events(): Promise<ProgressEvent[]> {
      return db.events.orderBy('at').toArray();
    },

    /** Toutes les réponses, de la plus ancienne à la plus récente. */
    async attempts(): Promise<Attempt[]> {
      return db.attempts.orderBy('at').toArray();
    },

    /**
     * Événements et réponses d'une étape, du plus ancien au plus récent. L'identifiant
     * de l'étape est renvoyé avec : une requête en direct peut encore rendre le résultat
     * d'une étape précédente pendant qu'elle relit la nouvelle.
     */
    async stepJournal(
      stepId: string,
    ): Promise<{ stepId: string; events: ProgressEvent[]; attempts: Attempt[] }> {
      const [events, attempts] = await Promise.all([
        db.events.where('stepId').equals(stepId).sortBy('at'),
        db.attempts.where('stepId').equals(stepId).sortBy('at'),
      ]);
      return { stepId, events, attempts };
    },

    /** Dernières séances commencées, de la plus récente à la plus ancienne. */
    async recentSessions(limit: number): Promise<SessionSummary[]> {
      const sessions = await db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
      return Promise.all(
        sessions.map(async (session) => {
          const attempts = await db.attempts.where('sessionId').equals(session.id).toArray();
          return {
            session,
            total: attempts.length,
            correct: attempts.filter((attempt) => attempt.correct).length,
          };
        }),
      );
    },

    async loadSettings(): Promise<Settings> {
      return normalizeSettings(await db.settings.get('settings'));
    },

    /**
     * Enregistre les réglages, et chaque réglage partagé modifié, horodaté : c'est
     * ce qui permet de fusionner les réglages entre appareils (§10.8).
     */
    async saveSettings(settings: Settings): Promise<void> {
      const device = await deviceId(db);
      await db.transaction('rw', [db.settings, db.settingChanges], async () => {
        const previous = normalizeSettings(await db.settings.get('settings'));
        const changes = settingChanges(previous, settings, await nextStamp(db), device);
        await db.settingChanges.bulkPut(changes.map(settingChangeRow));
        await db.settings.put({ ...settings, id: 'settings' });
      });
    },

    /** Tout le journal et les réglages, pour une sauvegarde (§10.6). */
    async exportAll(): Promise<BackupData> {
      return db.transaction('r', [db.sessions, db.attempts, db.events, db.settings], async () => {
        const [sessions, attempts, events, settings] = await Promise.all([
          db.sessions.orderBy('startedAt').toArray(),
          db.attempts.orderBy('at').toArray(),
          db.events.orderBy('at').toArray(),
          db.settings.get('settings'),
        ]);
        return { sessions, attempts, events, settings: normalizeSettings(settings) };
      });
    },

    /**
     * Remplace toutes les données par celles d'une sauvegarde, en une seule
     * transaction : en cas d'erreur, rien n'est modifié.
     */
    async replaceAll(data: BackupData): Promise<void> {
      const device = await deviceId(db);
      const tables = [
        db.sessions,
        db.attempts,
        db.events,
        db.settings,
        db.settingChanges,
        db.syncedKeys,
        db.syncMeta,
      ];
      await db.transaction('rw', tables, async () => {
        const previous = normalizeSettings(await db.settings.get('settings'));
        await Promise.all([
          db.sessions.clear(),
          db.attempts.clear(),
          db.events.clear(),
          db.settings.clear(),
          // Avec la synchronisation active, tout le dossier du serveur sera relu et
          // fusionné avec la sauvegarde importée, puis celle-ci envoyée.
          db.syncedKeys.clear(),
        ]);
        if (await db.syncMeta.get('cursor')) await db.syncMeta.put({ key: 'cursor', value: 0 });
        await db.sessions.bulkAdd(data.sessions);
        await db.attempts.bulkAdd(data.attempts);
        await db.events.bulkAdd(data.events);
        const changes = settingChanges(previous, data.settings, await nextStamp(db), device);
        await db.settingChanges.bulkPut(changes.map(settingChangeRow));
        await db.settings.put({ ...data.settings, id: 'settings' });
      });
    },
  };
}

export type Journal = ReturnType<typeof createJournal>;
