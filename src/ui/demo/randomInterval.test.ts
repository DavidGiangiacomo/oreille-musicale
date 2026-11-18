import { describe, expect, it } from 'vitest';
import { INTERVALS, midiOf } from '../../core/theory';
import { describeInterval, randomInterval } from './randomInterval';

/** Générateur déterministe pour des tirages reproductibles. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe('randomInterval', () => {
  it('reste dans le registre F3–F5 et respecte la taille et le sens de l’intervalle', () => {
    const random = seeded(42);
    let previous: number | null = null;
    for (let i = 0; i < 500; i++) {
      const interval = randomInterval(previous, random);
      const [first, second] = interval.notes.map(midiOf) as [number, number];
      const expected = INTERVALS[interval.code].semitones;
      expect(Math.abs(second - first)).toBe(expected);
      expect(interval.presentation === 'desc' ? first > second : second > first).toBe(true);
      for (const midi of [first, second]) {
        expect(midi).toBeGreaterThanOrEqual(53);
        expect(midi).toBeLessThanOrEqual(77);
      }
      expect(first).not.toBe(previous);
      expect(interval.events.map((e) => e.midi)).toEqual([first, second]);
      previous = first;
    }
  });
});

describe('describeInterval', () => {
  it('accorde le qualificatif avec le nom de l’intervalle', () => {
    expect(describeInterval('m3', 'asc')).toBe('Tierce mineure ascendante');
    expect(describeInterval('TT', 'desc')).toBe('Triton descendant');
    expect(describeInterval('P8', 'harm')).toBe('Octave harmonique');
  });
});
