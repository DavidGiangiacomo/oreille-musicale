import { describe, expect, it } from 'vitest';
import { frenchIntervalLabel } from './intervals';
import { letterIndex, midiOf } from './notes';
import { MODE_CODES, MODES, SCALE_CODES, SCALES, scaleNotes, spellScale } from './scales';

/** Structures en demi-tons, recopiées du document de conception (§6.3). */
const EXPECTED_SEMITONES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  natmin: [0, 2, 3, 5, 7, 8, 10],
  harmin: [0, 2, 3, 5, 7, 8, 11],
  melmin: [0, 2, 3, 5, 7, 9, 11],
  pentmaj: [0, 2, 4, 7, 9],
  pentmin: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

const ALL_CODES = [...SCALE_CODES, ...MODE_CODES];
const ROOT_MIDIS = Array.from({ length: 12 }, (_, i) => 60 + i);
const definitionOf = (code: (typeof ALL_CODES)[number]) =>
  code in SCALES ? SCALES[code as keyof typeof SCALES] : MODES[code as keyof typeof MODES];

describe('SCALES et MODES', () => {
  it('correspondent aux tableaux du document de conception', () => {
    for (const code of ALL_CODES) {
      expect(definitionOf(code).semitones).toEqual(EXPECTED_SEMITONES[code]);
    }
  });

  it('rangent les modes du plus lumineux au plus sombre, une note abaissée à chaque pas', () => {
    for (let i = 1; i < MODE_CODES.length; i++) {
      const brighter = MODES[MODE_CODES[i - 1]!].semitones;
      const darker = MODES[MODE_CODES[i]!].semitones;
      const differences = brighter.map((s, degree) => s - (darker[degree] ?? s));
      expect(differences.filter((d) => d !== 0)).toEqual([1]);
    }
  });

  it('indiquent la note caractéristique de chaque mode', () => {
    const labels = Object.fromEntries(
      MODE_CODES.map((code) => [code, MODES[code].characteristic.map(frenchIntervalLabel)]),
    );
    expect(labels).toEqual({
      lydian: ['4+'],
      ionian: [],
      mixolydian: ['7m'],
      dorian: ['6M'],
      aeolian: [],
      phrygian: ['2m'],
      locrian: ['2m', '5−'],
    });
  });

  it('ne diffèrent de leur référence que par leurs notes caractéristiques', () => {
    for (const code of MODE_CODES) {
      const mode = MODES[code];
      if (mode.reference === null) continue;
      const reference = MODES[mode.reference];
      const changed = mode.intervals.filter((interval, i) => interval !== reference.intervals[i]);
      expect(changed).toEqual(mode.characteristic);
    }
  });
});

describe('spellScale', () => {
  it.each(ALL_CODES)('construit %s sur les 12 toniques', (code) => {
    const def = definitionOf(code);
    for (const midi of ROOT_MIDIS) {
      const notes = spellScale(midi, code);
      expect(notes.map((n) => midiOf(n) - midi)).toEqual([...def.semitones, 12]);
      if (def.intervals.length === 7) {
        // Gammes à 7 notes : une lettre par degré.
        const letters = notes.slice(0, 7).map(letterIndex);
        expect(new Set(letters).size).toBe(7);
      }
    }
  });

  it('écrit les gammes comme dans le document de conception', () => {
    expect(scaleNotes('C4', 'dorian')).toEqual(['C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4', 'C5']);
    expect(scaleNotes('D4', 'dorian')).toEqual(['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5']);
    expect(scaleNotes('C4', 'blues')).toEqual(['C4', 'Eb4', 'F4', 'Gb4', 'G4', 'Bb4', 'C5']);
    expect(spellScale(68, 'harmin')).toEqual([
      'Ab4',
      'Bb4',
      'Cb5',
      'Db5',
      'Eb5',
      'Fb5',
      'G5',
      'Ab5',
    ]);
  });
});
