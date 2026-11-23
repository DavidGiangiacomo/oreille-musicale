import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SessionRecord } from '../journal';
import {
  allSettingChanges,
  isNewer,
  latestChanges,
  mergeSession,
  resolveSettings,
  settingChanges,
} from './merge';
import { parseEnvelope, recordKey, SYNC_FORMAT, type SettingChange } from './records';

const session = (endedAt?: number): SessionRecord => ({
  id: 's1',
  kind: 'custom',
  startedAt: 10,
  ...(endedAt === undefined ? {} : { endedAt }),
  appVersion: '1.0.0',
  curriculumVersion: '3',
});

describe('fusion des séances', () => {
  it('garde la version terminée, et la fin la plus tardive', () => {
    expect(mergeSession(undefined, session())).toEqual(session());
    expect(mergeSession(session(), session(50))).toEqual(session(50));
    expect(mergeSession(session(50), session())).toBeNull();
    expect(mergeSession(session(50), session(80))).toEqual(session(80));
    expect(mergeSession(session(80), session(50))).toBeNull();
  });

  it('donne le même résultat quel que soit l’ordre d’arrivée', () => {
    const version = fc.option(fc.integer({ min: 11, max: 1000 }), { nil: undefined });
    fc.assert(
      fc.property(fc.array(version, { minLength: 1, maxLength: 6 }), (ends) => {
        const apply = (order: (number | undefined)[]) =>
          order.reduce<SessionRecord | undefined>(
            (local, end) => mergeSession(local, session(end)) ?? local,
            undefined,
          );
        expect(apply(ends)?.endedAt).toBe(apply([...ends].reverse())?.endedAt);
      }),
    );
  });
});

const change = (field: SettingChange['field'], value: unknown, at: number, device = 'a') => ({
  field,
  value,
  at,
  device,
});

describe('fusion des réglages', () => {
  it('retient la modification la plus récente de chaque réglage, puis l’appareil', () => {
    expect(isNewer(change('tempo', 'slow', 2), change('tempo', 'fast', 1))).toBe(true);
    expect(isNewer(change('tempo', 'slow', 1, 'b'), change('tempo', 'fast', 1, 'a'))).toBe(true);
    // Même instant, même appareil : la valeur départage, toujours dans le même sens.
    expect(isNewer(change('tempo', 'slow', 1), change('tempo', 'fast', 1))).toBe(true);
    expect(isNewer(change('tempo', 'fast', 1), change('tempo', 'slow', 1))).toBe(false);
    const latest = latestChanges([
      change('tempo', 'slow', 5),
      change('tempo', 'fast', 9),
      change('noteNames', 'en', 3),
    ]);
    expect(latest.get('tempo')?.value).toBe('fast');
    expect(latest.get('noteNames')?.value).toBe('en');
  });

  it('converge quel que soit l’ordre des modifications', () => {
    const anyChange = fc.record({
      field: fc.constantFrom('tempo' as const),
      value: fc.constantFrom('slow', 'normal', 'fast'),
      at: fc.integer({ min: 0, max: 20 }),
      device: fc.constantFrom('a', 'b'),
    });
    fc.assert(
      fc.property(fc.array(anyChange, { maxLength: 8 }), (changes) => {
        const forward = resolveSettings(DEFAULT_SETTINGS, changes);
        const backward = resolveSettings(DEFAULT_SETTINGS, [...changes].reverse());
        expect(forward.tempo).toBe(backward.tempo);
      }),
    );
  });

  it('laisse de côté une valeur qu’il ne comprend pas', () => {
    const settings = { ...DEFAULT_SETTINGS, instrument: 'strings' as const };
    const resolved = resolveSettings(settings, [change('instrument', 'guitar', 9)]);
    expect(resolved.instrument).toBe('strings');
    expect(resolved).toBe(settings);
  });

  it('ne note que les réglages partagés qui changent', () => {
    const next = {
      ...DEFAULT_SETTINGS,
      tempo: 'slow' as const,
      volume: 0.3,
      theme: 'dark' as const,
    };
    expect(settingChanges(DEFAULT_SETTINGS, next, 7, 'a')).toEqual([change('tempo', 'slow', 7)]);
    expect(allSettingChanges(DEFAULT_SETTINGS, 7, 'a').map((c) => c.field)).not.toContain('volume');
  });
});

describe('enregistrements échangés', () => {
  it('donne une clé par version d’enregistrement', () => {
    expect(recordKey({ kind: 'session', value: session() })).toBe('session:s1:open');
    expect(recordKey({ kind: 'session', value: session(40) })).toBe('session:s1:40');
    expect(recordKey({ kind: 'setting', value: change('tempo', 'slow', 3, 'b') })).toBe(
      'setting:tempo:3:b',
    );
  });

  it('vérifie ce qui arrive et met de côté les formats plus récents', () => {
    const ok = parseEnvelope({ v: SYNC_FORMAT, record: { kind: 'session', value: session(4) } });
    expect(ok).toEqual({ ok: true, record: { kind: 'session', value: session(4) } });
    expect(parseEnvelope({ v: SYNC_FORMAT + 1, record: {} })).toEqual({
      ok: false,
      reason: 'newer',
    });
    expect(parseEnvelope({ v: SYNC_FORMAT, record: { kind: 'chant', value: {} } })).toEqual({
      ok: false,
      reason: 'newer',
    });
    expect(
      parseEnvelope({ v: SYNC_FORMAT, record: { kind: 'session', value: { id: 3 } } }),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(
      parseEnvelope({
        v: SYNC_FORMAT,
        // Le volume reste propre à chaque appareil : il ne s'échange pas.
        record: { kind: 'setting', value: { field: 'volume', value: 1, at: 2, device: 'a' } },
      }),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(parseEnvelope('texte')).toEqual({ ok: false, reason: 'invalid' });
  });
});
