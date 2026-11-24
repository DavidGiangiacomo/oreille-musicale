import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOICING,
  frequencyFromMidi,
  isVoiced,
  midiFromFrequency,
  nearestNote,
  noteNameOf,
  smoothPitches,
} from './pitch';

describe('hauteur chantée', () => {
  it('passe de la fréquence à la note et à l’écart en cents', () => {
    expect(midiFromFrequency(440)).toBe(69);
    expect(frequencyFromMidi(60)).toBeCloseTo(261.63, 2);
    expect(nearestNote(69.2)).toEqual({ midi: 69, cents: 20 });
    expect(nearestNote(68.7)).toEqual({ midi: 69, cents: -30 });
    expect(noteNameOf(61)).toBe('C#4');
    expect(noteNameOf(45)).toBe('A2');
  });

  it('ne retient que la voix nette, assez forte et dans la tessiture humaine', () => {
    const base = { time: 0, frequency: 220, clarity: 0.95, levelDb: -30 };
    expect(isVoiced(base)).toBe(true);
    expect(isVoiced({ ...base, clarity: 0.5 })).toBe(false);
    expect(isVoiced({ ...base, levelDb: DEFAULT_VOICING.minLevelDb - 1 })).toBe(false);
    expect(isVoiced({ ...base, frequency: 40 })).toBe(false);
    expect(isVoiced({ ...base, frequency: null })).toBe(false);
  });

  it('corrige une erreur d’octave isolée et lisse les petites variations', () => {
    expect(smoothPitches([57, 57.1, 69, 57, 56.9])).toEqual([57, 57, 57, 57, 57]);
    const smoothed = smoothPitches([60, 60.3, 59.8, 60.1, 60]);
    for (const value of smoothed) expect(Math.abs(value! - 60)).toBeLessThan(0.2);
    expect(smoothPitches([null, 60, null])).toEqual([null, 60, null]);
  });
});
