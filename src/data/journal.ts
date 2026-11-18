import {
  normalizeSettings,
  type Attempt,
  type SessionRecord,
  type Settings,
} from '../core/journal';
import type { OreilleDatabase } from './database';

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

    async attemptsOf(sessionId: string): Promise<Attempt[]> {
      return db.attempts.where('sessionId').equals(sessionId).sortBy('at');
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

    async saveSettings(settings: Settings): Promise<void> {
      await db.settings.put({ ...settings, id: 'settings' });
    },
  };
}

export type Journal = ReturnType<typeof createJournal>;
