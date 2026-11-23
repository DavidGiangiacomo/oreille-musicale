import 'fake-indexeddb/auto';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import type { Attempt, ProgressEvent, SessionRecord, Settings } from '../core/journal';
import { SYNCED_SETTINGS } from '../core/sync/records';
import { createJournal, createSyncStore, openDatabase, type OreilleDatabase } from '../data';
import { deriveSyncKeys, encodeSyncKey, generateSecret, seal, type SyncKeys } from './crypto';
import { BATCH_SIZE, synchronize } from './engine';
import { MemorySyncServer, SyncOffline } from './memoryServer';

// Deux appareils simulés, chacun avec sa base, et un serveur en mémoire (§10.8).

let databases: OreilleDatabase[] = [];
let counter = 0;

afterEach(async () => {
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases = [];
});

interface Device {
  name: string;
  db: OreilleDatabase;
  journal: ReturnType<typeof createJournal>;
  store: ReturnType<typeof createSyncStore>;
  online: boolean;
  sync: () => Promise<boolean>;
}

function device(name: string, server: MemorySyncServer, keys: SyncKeys): Device {
  const db = openDatabase(`sync-${name}-${++counter}`);
  databases.push(db);
  const store = createSyncStore(db);
  const dev: Device = {
    name,
    db,
    journal: createJournal(db),
    store,
    online: true,
    sync: async () => {
      try {
        await synchronize(
          keys,
          store,
          server.transport(keys.bucket, keys.token, () => dev.online),
        );
        return true;
      } catch (error) {
        if (error instanceof SyncOffline) return false;
        throw error;
      }
    },
  };
  return dev;
}

async function setup() {
  const server = new MemorySyncServer();
  const secret = generateSecret();
  const keys = await deriveSyncKeys(secret);
  return { server, keys, syncKey: encodeSyncKey(secret) };
}

const session = (id: string, at: number): SessionRecord => ({
  id,
  kind: 'step',
  startedAt: at,
  appVersion: '2.0.0',
  curriculumVersion: '3',
  stepId: 'int.asc.01',
});

const attempt = (id: string, sessionId: string, at: number): Attempt => ({
  id,
  sessionId,
  at,
  activity: 'test',
  stepId: 'int.asc.01',
  competenceId: 'int:M3:asc',
  rendition: {
    midi: [60, 64],
    spelling: ['C4', 'E4'],
    presentation: 'asc',
    instrument: 'piano',
    tempo: 'normal',
  },
  answer: { type: 'choice', value: 'M3' },
  correct: true,
  responseTimeMs: 900,
  replays: 0,
  helpUsed: false,
});

const validated = (id: string, at: number): ProgressEvent => ({
  id,
  at,
  type: 'step_validated',
  stepId: 'int.asc.01',
  score: 1,
  competenceIds: ['int:M3:asc'],
});

/** Ce que les deux appareils doivent partager : le journal et les réglages partagés. */
async function shared(dev: Device) {
  const data = await dev.journal.exportAll();
  const byId = <T extends { id: string }>(list: T[]) =>
    [...list].sort((a, b) => a.id.localeCompare(b.id));
  const settings = Object.fromEntries(
    SYNCED_SETTINGS.map((field) => [field, data.settings[field]]),
  );
  return {
    sessions: byId(data.sessions),
    attempts: byId(data.attempts),
    events: byId(data.events),
    settings,
  };
}

async function practice(dev: Device, id: string, at: number, end = true) {
  await dev.journal.startSession(session(`${id}-s`, at));
  await dev.journal.addAttempt(attempt(`${id}-a`, `${id}-s`, at + 1));
  await dev.journal.addEvent(validated(`${id}-e`, at + 2));
  if (end) await dev.journal.endSession(`${id}-s`, at + 3);
}

async function change(dev: Device, changes: Partial<Settings>) {
  const current = await dev.journal.loadSettings();
  await dev.journal.saveSettings({ ...current, ...changes });
}

describe('synchronisation entre deux appareils', () => {
  it('fusionne deux appareils qui avaient déjà des données, sans rien écraser', async () => {
    const { server, keys, syncKey } = await setup();
    const a = device('a', server, keys);
    const b = device('b', server, keys);
    await practice(a, 'a1', 1_000);
    await change(a, { tempo: 'slow', noteNames: 'en' });
    await practice(b, 'b1', 2_000);
    await change(b, { volume: 0.3, theme: 'dark' });

    // A crée la clé (ses réglages font foi), B la rejoint.
    await a.store.enable(syncKey, true);
    await a.sync();
    await b.store.enable(syncKey, false);
    await b.sync();
    await a.sync();

    expect(await shared(a)).toEqual(await shared(b));
    const settingsB = await b.journal.loadSettings();
    expect(settingsB.tempo).toBe('slow');
    expect(settingsB.noteNames).toBe('en');
    // Volume et thème restent propres à chaque appareil.
    expect(settingsB.volume).toBe(0.3);
    expect(settingsB.theme).toBe('dark');
    expect((await a.journal.loadSettings()).theme).toBe('system');
    expect((await shared(a)).events.map((e) => e.id)).toEqual(['a1-e', 'b1-e']);
  });

  it('propage la fin d’une séance et la dernière modification de chaque réglage', async () => {
    const { server, keys, syncKey } = await setup();
    const a = device('a', server, keys);
    const b = device('b', server, keys);
    await a.store.enable(syncKey, true);
    await b.store.enable(syncKey, false);
    await practice(a, 'a1', 1_000, false);
    await a.sync();
    await b.sync();
    expect((await shared(b)).sessions[0]?.endedAt).toBeUndefined();

    await a.journal.endSession('a1-s', 5_000);
    await change(b, { tempo: 'fast' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await change(a, { tempo: 'slow' });
    await a.sync();
    await b.sync();
    await a.sync();
    const [stateA, stateB] = [await shared(a), await shared(b)];
    expect(stateA).toEqual(stateB);
    expect(stateB.sessions[0]?.endedAt).toBe(5_000);
    expect(stateB.settings.tempo).toBe('slow');
  });

  it('arrive au même état quel que soit l’ordre des envois, hors ligne compris', async () => {
    type Op =
      | { kind: 'practice' | 'sync' | 'toggle'; on: 'a' | 'b' }
      | { kind: 'setting'; on: 'a' | 'b'; tempo: Settings['tempo'] };
    const op: fc.Arbitrary<Op> = fc.oneof(
      fc.record({
        kind: fc.constantFrom('practice' as const, 'sync' as const, 'toggle' as const),
        on: fc.constantFrom('a' as const, 'b' as const),
      }),
      fc.record({
        kind: fc.constant('setting' as const),
        on: fc.constantFrom('a' as const, 'b' as const),
        tempo: fc.constantFrom('slow' as const, 'normal' as const, 'fast' as const),
      }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(op, { maxLength: 14 }), async (ops) => {
        const { server, keys, syncKey } = await setup();
        const devices = { a: device('a', server, keys), b: device('b', server, keys) };
        await devices.a.store.enable(syncKey, true);
        await devices.b.store.enable(syncKey, false);
        let n = 0;
        for (const step of ops) {
          const dev = devices[step.on];
          n += 1;
          if (step.kind === 'practice') await practice(dev, `${step.on}${n}`, n * 10, n % 3 !== 0);
          if (step.kind === 'setting') await change(dev, { tempo: step.tempo });
          if (step.kind === 'toggle') dev.online = !dev.online;
          if (step.kind === 'sync') await dev.sync();
        }
        devices.a.online = true;
        devices.b.online = true;
        await devices.a.sync();
        await devices.b.sync();
        await devices.a.sync();
        expect(await shared(devices.a)).toEqual(await shared(devices.b));
      }),
      { numRuns: 25 },
    );
  });

  it('reprend après une coupure au milieu d’un envoi', async () => {
    const { server, keys, syncKey } = await setup();
    const a = device('a', server, keys);
    const b = device('b', server, keys);
    await a.store.enable(syncKey, true);
    await a.journal.startSession(session('s', 1));
    for (let i = 0; i < BATCH_SIZE + 50; i++) {
      await a.journal.addAttempt(attempt(`x${String(i).padStart(3, '0')}`, 's', 2 + i));
    }
    // La connexion tombe après le premier lot.
    let calls = 0;
    const flaky = server.transport(keys.bucket, keys.token, () => ++calls <= 1);
    await expect(synchronize(keys, a.store, flaky)).rejects.toBeInstanceOf(SyncOffline);
    expect(server.size(keys.bucket)).toBe(BATCH_SIZE);

    await a.sync();
    await b.store.enable(syncKey, false);
    await b.sync();
    expect((await shared(b)).attempts).toHaveLength(BATCH_SIZE + 50);
    expect(await a.store.pending()).toEqual([]);
  });

  it('garde de côté un enregistrement d’une version plus récente, sans le perdre', async () => {
    const { server, keys, syncKey } = await setup();
    const a = device('a', server, keys);
    await a.store.enable(syncKey, true);
    const future = await seal(keys, 'chant:1', { v: 99, record: { kind: 'chant', value: {} } });
    await server.transport(keys.bucket, keys.token).push([future]);

    await a.sync();
    expect((await a.store.deferred()).map((row) => row.id)).toEqual([future.id]);
    await a.sync();
    expect(await a.store.deferred()).toHaveLength(1);
  });

  it('ne laisse au serveur que des blocs illisibles', async () => {
    const { server, keys, syncKey } = await setup();
    const a = device('a', server, keys);
    await a.store.enable(syncKey, true);
    await practice(a, 'secret-practice', 1_000);
    await a.sync();
    const { records } = await server.transport(keys.bucket, keys.token).pull(0, 1_000);
    expect(records.length).toBeGreaterThan(0);
    const visible = JSON.stringify(records);
    for (const word of ['secret-practice', 'attempt', 'session', 'int:M3', 'tempo']) {
      expect(visible).not.toContain(word);
    }
  });

  it('fusionne une sauvegarde importée avec ce que le serveur connaît déjà', async () => {
    const { server, keys, syncKey } = await setup();
    const a = device('a', server, keys);
    const b = device('b', server, keys);
    await a.store.enable(syncKey, true);
    await practice(a, 'a1', 1_000);
    await a.sync();

    // B importe une sauvegarde ancienne, puis rejoint la synchronisation.
    const old = device('old', server, keys);
    await practice(old, 'old1', 500);
    await b.journal.replaceAll(await old.journal.exportAll());
    await b.store.enable(syncKey, false);
    await b.sync();
    await a.sync();
    const ids = (await shared(a)).events.map((e) => e.id);
    expect(ids).toEqual(['a1-e', 'old1-e']);
    expect(await shared(a)).toEqual(await shared(b));
  });
});
