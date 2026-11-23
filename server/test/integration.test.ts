import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Attempt, SessionRecord } from '../../src/core/journal';
import { createJournal, createSyncStore, openDatabase } from '../../src/data';
import { deriveSyncKeys, encodeSyncKey, generateSecret } from '../../src/sync/crypto';
import { synchronize } from '../../src/sync/engine';
import { deleteRemote, httpTransport, SyncServerError } from '../../src/sync/httpTransport';
import { handle, type Env } from '../src/worker';
import { SqliteD1 } from './sqliteD1';

// Le moteur de synchronisation de l'appli, par HTTP, contre le vrai code du serveur.

const session = (id: string): SessionRecord => ({
  id,
  kind: 'custom',
  startedAt: 1,
  endedAt: 9,
  appVersion: '2.0.0',
  curriculumVersion: '3',
});

const attempt = (id: string, sessionId: string, at: number): Attempt => ({
  id,
  sessionId,
  at,
  activity: 'custom',
  competenceId: 'int:P5:harm',
  rendition: {
    midi: [55, 62],
    spelling: ['G3', 'D4'],
    presentation: 'harm',
    instrument: 'strings',
    tempo: 'normal',
  },
  answer: { type: 'choice', value: 'P5' },
  correct: at % 2 === 0,
  responseTimeMs: 1200,
  replays: 1,
  helpUsed: false,
});

let counter = 0;

async function setup() {
  const d1 = new SqliteD1();
  const env = { DB: d1 } as unknown as Env;
  const fetchImpl: typeof fetch = async (input, init) => handle(new Request(input, init), env);
  const secret = generateSecret();
  const keys = await deriveSyncKeys(secret);
  const access = { url: 'https://sync.test/', bucket: keys.bucket, token: keys.token };
  const transport = httpTransport(access, fetchImpl);
  const device = () => {
    const db = openDatabase(`integration-${++counter}`);
    return { db, journal: createJournal(db), store: createSyncStore(db) };
  };
  return { d1, keys, access, fetchImpl, transport, device, syncKey: encodeSyncKey(secret) };
}

describe('synchronisation par le serveur', () => {
  it('deux appareils retrouvent la même progression', async () => {
    const { keys, transport, device, syncKey } = await setup();
    const a = device();
    const b = device();
    await a.journal.startSession(session('sa'));
    for (let i = 0; i < 450; i++) await a.journal.addAttempt(attempt(`a${i}`, 'sa', 10 + i));
    await b.journal.startSession(session('sb'));
    await b.journal.addAttempt(attempt('b0', 'sb', 5));

    await a.store.enable(syncKey, true);
    await b.store.enable(syncKey, false);
    const first = await synchronize(keys, a.store, transport);
    expect(first.sent).toBeGreaterThan(450);
    await synchronize(keys, b.store, transport);
    await synchronize(keys, a.store, transport);

    for (const dev of [a, b]) {
      expect(await dev.db.attempts.count()).toBe(451);
      expect(await dev.db.sessions.count()).toBe(2);
    }
    // Une nouvelle synchronisation n'envoie ni ne reçoit plus rien de neuf.
    const again = await synchronize(keys, b.store, transport);
    expect(again.sent).toBe(0);
    for (const dev of [a, b]) dev.db.close();
  });

  it('signale un jeton refusé, puis efface le dossier', async () => {
    const { d1, keys, access, fetchImpl, transport, device, syncKey } = await setup();
    const a = device();
    await a.journal.startSession(session('s'));
    await a.store.enable(syncKey, true);
    await synchronize(keys, a.store, transport);

    const intruder = httpTransport({ ...access, token: 'Z'.repeat(43) }, fetchImpl);
    await expect(intruder.pull(0, 10)).rejects.toEqual(new SyncServerError(403));

    await deleteRemote(access, fetchImpl);
    expect(d1.db.prepare('SELECT COUNT(*) AS n FROM records').get()).toEqual({ n: 0 });
    a.db.close();
  });
});
