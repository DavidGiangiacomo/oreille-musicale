import { describe, expect, it } from 'vitest';
import { backupFileName, BACKUP_VERSION, createBackup, parseBackup } from './backup';
import { DEFAULT_SETTINGS, type Attempt } from './journal';

const attempt: Attempt = {
  id: 'a1',
  sessionId: 's1',
  at: Date.UTC(2026, 10, 18, 9),
  activity: 'free',
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
};

const backup = createBackup(
  {
    settings: { ...DEFAULT_SETTINGS, noteNames: 'en' },
    sessions: [
      {
        id: 's1',
        kind: 'custom',
        startedAt: attempt.at - 1000,
        appVersion: '0.1.0',
        curriculumVersion: '3',
      },
    ],
    attempts: [attempt],
    events: [
      { id: 'e1', at: attempt.at, type: 'phase_started', stepId: 'int.asc.01', phase: 'train' },
    ],
  },
  { schemaVersion: 2, appVersion: '0.1.0', curriculumVersion: '3', at: Date.UTC(2026, 10, 19, 10) },
);

describe('sauvegarde', () => {
  it('se relit à l’identique, avec un résumé', () => {
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup).toEqual(backup);
    expect(parsed.summary).toEqual({
      exportedAt: Date.UTC(2026, 10, 19, 10),
      sessions: 1,
      attempts: 1,
      firstAt: attempt.at,
      lastAt: attempt.at,
    });
  });

  it('refuse ce qui n’est pas une sauvegarde valide', () => {
    const errors = [
      'pas du JSON',
      JSON.stringify({ format: 'autre' }),
      JSON.stringify({ ...backup, version: BACKUP_VERSION + 1 }),
      JSON.stringify({ ...backup, attempts: [{ ...attempt, at: 'hier' }] }),
      JSON.stringify({ ...backup, events: [{ id: 'e', at: 1, type: 'inconnu', stepId: 'x' }] }),
      JSON.stringify({ ...backup, sessions: undefined }),
    ].map((text) => parseBackup(text));
    for (const result of errors) expect(result.ok).toBe(false);
    expect(errors[2]).toMatchObject({ error: expect.stringContaining('plus récente') });
  });

  it('normalise des réglages incomplets', () => {
    const parsed = parseBackup(JSON.stringify({ ...backup, settings: { volume: 9 } }));
    expect(parsed.ok && parsed.backup.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('nomme le fichier par sa date', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23).getTime())).toBe(
      'oreille-musicale-2026-01-05.json',
    );
  });
});
