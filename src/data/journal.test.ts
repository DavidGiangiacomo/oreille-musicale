import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Attempt, type SessionRecord } from '../core/journal';
import { openDatabase, SCHEMA_VERSIONS, type OreilleDatabase } from './database';
import { createJournal } from './journal';

let databases: OreilleDatabase[] = [];
let counter = 0;

function freshDatabase(name = `test-${++counter}`) {
  const db = openDatabase(name);
  databases.push(db);
  return db;
}

afterEach(async () => {
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases = [];
});

const session = (id: string, startedAt: number): SessionRecord => ({
  id,
  kind: 'custom',
  startedAt,
  appVersion: '0.1.0',
  curriculumVersion: '0',
  config: { presentation: 'asc', items: ['M3', 'P5'], length: 2 },
});

const attempt = (id: string, sessionId: string, at: number, correct: boolean): Attempt => ({
  id,
  sessionId,
  at,
  activity: 'free',
  competenceId: 'int:M3:asc',
  rendition: {
    midi: [60, 64],
    spelling: ['C4', 'E4'],
    presentation: 'asc',
    instrument: 'piano',
    tempo: 'normal',
  },
  choices: ['M3', 'P5'],
  answer: { type: 'choice', value: correct ? 'M3' : 'P5' },
  correct,
  responseTimeMs: 900,
  replays: 0,
  helpUsed: false,
});

describe('journal', () => {
  it('enregistre une séance et ses réponses', async () => {
    const journal = createJournal(freshDatabase());
    await journal.startSession(session('s1', 1000));
    await journal.addAttempt(attempt('a2', 's1', 3000, false));
    await journal.addAttempt(attempt('a1', 's1', 2000, true));
    await journal.endSession('s1', 4000);

    const attempts = await journal.attemptsOf('s1');
    expect(attempts.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(attempts[1]?.answer).toEqual({ type: 'choice', value: 'P5' });
    const [summary] = await journal.recentSessions(5);
    expect(summary).toMatchObject({ total: 2, correct: 1, session: { id: 's1', endedAt: 4000 } });
  });

  it('liste les dernières séances, la plus récente d’abord', async () => {
    const journal = createJournal(freshDatabase());
    for (const [id, at] of [
      ['ancienne', 1],
      ['récente', 3],
      ['moyenne', 2],
    ] as const) {
      await journal.startSession(session(id, at));
    }
    const recent = await journal.recentSessions(2);
    expect(recent.map((s) => s.session.id)).toEqual(['récente', 'moyenne']);
    expect(recent[0]?.total).toBe(0);
  });

  it('retrouve les données après réouverture de la base', async () => {
    const name = `réouverture-${++counter}`;
    const first = openDatabase(name);
    await createJournal(first).startSession(session('s1', 1));
    await createJournal(first).addAttempt(attempt('a1', 's1', 2, true));
    first.close();

    const second = freshDatabase(name);
    expect(await createJournal(second).attemptsOf('s1')).toHaveLength(1);
  });

  it('donne les réglages par défaut, puis ceux enregistrés', async () => {
    const journal = createJournal(freshDatabase());
    expect(await journal.loadSettings()).toEqual(DEFAULT_SETTINGS);
    await journal.saveSettings({ ...DEFAULT_SETTINGS, noteNames: 'en', autoAdvance: false });
    expect(await journal.loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      noteNames: 'en',
      autoAdvance: false,
    });
  });
});

describe('schéma de la base', () => {
  it('reste celui de la version publiée (toute modification exige une nouvelle version)', async () => {
    const db = freshDatabase();
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSIONS.at(-1)?.version);
    const schema = Object.fromEntries(
      db.tables.map((table) => [
        table.name,
        [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)].join(', '),
      ]),
    );
    expect(schema).toEqual({
      sessions: 'id, startedAt',
      attempts: 'id, sessionId, at, competenceId, stepId',
      settings: 'id',
      events: 'id, at, stepId, type',
    });
  });

  it('migre une base de la version 1 sans perdre de données', async () => {
    const name = `migration-${++counter}`;
    const v1 = openDatabase(name, 1);
    await v1.open();
    expect(v1.verno).toBe(1);
    await createJournal(v1).startSession(session('s1', 1));
    await v1.attempts.add(attempt('a1', 's1', 2, true));
    await v1.settings.put({ id: 'settings', noteNames: 'en' });
    v1.close();

    const current = freshDatabase(name);
    await current.open();
    expect(current.verno).toBe(SCHEMA_VERSIONS.at(-1)?.version);
    const journal = createJournal(current);
    expect(await journal.attemptsOf('s1')).toHaveLength(1);
    expect((await journal.loadSettings()).noteNames).toBe('en');
    expect(await journal.events()).toEqual([]);
  });
});

describe('événements et étapes', () => {
  it('retrouve les événements et les réponses d’une étape, dans l’ordre', async () => {
    const journal = createJournal(freshDatabase());
    await journal.addEvent({
      id: 'e2',
      at: 20,
      type: 'phase_started',
      stepId: 'int.asc.01',
      phase: 'train',
    });
    await journal.addEvent({
      id: 'e1',
      at: 10,
      type: 'phase_started',
      stepId: 'int.asc.01',
      phase: 'discover',
    });
    await journal.addEvent({
      id: 'e3',
      at: 15,
      type: 'phase_started',
      stepId: 'int.asc.02',
      phase: 'discover',
    });
    await journal.addAttempt({
      ...attempt('a1', 's1', 30, true),
      activity: 'train',
      stepId: 'int.asc.01',
    });
    await journal.addAttempt(attempt('a2', 's1', 31, true));

    const { stepId, events, attempts } = await journal.stepJournal('int.asc.01');
    expect(stepId).toBe('int.asc.01');
    expect(events.map((event) => event.id)).toEqual(['e1', 'e2']);
    expect(attempts.map((a) => a.id)).toEqual(['a1']);
    expect((await journal.events()).map((event) => event.id)).toEqual(['e1', 'e3', 'e2']);
    expect((await journal.attempts()).map((a) => a.id)).toEqual(['a1', 'a2']);
  });
});
