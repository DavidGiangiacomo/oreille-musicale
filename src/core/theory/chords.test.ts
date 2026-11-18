import { Interval } from 'tonal';
import { describe, expect, it } from 'vitest';
import { CHORD_QUALITIES, CHORDS, chordNotes, chordSymbol, invert, spellChord } from './chords';
import { letterIndex, midiOf } from './notes';

/** Structures en demi-tons, recopiées du document de conception (§6.2). */
const EXPECTED_SEMITONES: Record<string, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  mmaj7: [0, 3, 7, 11],
  '7sus4': [0, 5, 7, 10],
};

const ROOT_MIDIS = Array.from({ length: 12 }, (_, i) => 60 + i);

describe('CHORDS', () => {
  it('correspond au tableau du document de conception', () => {
    for (const quality of CHORD_QUALITIES) {
      expect(CHORDS[quality].semitones).toEqual(EXPECTED_SEMITONES[quality]);
    }
  });

  it('classe les accords en triades et en septièmes', () => {
    const triads = CHORD_QUALITIES.filter((q) => CHORDS[q].family === 'triad');
    expect(triads).toEqual(['maj', 'min', 'dim', 'aug', 'sus4', 'sus2']);
    for (const quality of CHORD_QUALITIES) {
      expect(CHORDS[quality].intervals).toHaveLength(CHORDS[quality].family === 'triad' ? 3 : 4);
    }
  });
});

describe('spellChord', () => {
  it.each(CHORD_QUALITIES)('construit %s sur les 12 fondamentales', (quality) => {
    const chord = CHORDS[quality];
    for (const midi of ROOT_MIDIS) {
      const notes = spellChord(midi, quality);
      expect(notes.map((n) => midiOf(n) - midi)).toEqual(chord.semitones);

      // Une lettre par degré : la tierce porte la lettre de la tierce, etc.
      const root = notes[0] ?? '';
      notes.forEach((note, i) => {
        const degree = Interval.get(chord.intervals[i] ?? '').num ?? 1;
        expect((letterIndex(note) - letterIndex(root) + 7) % 7).toBe((degree - 1) % 7);
      });
    }
  });

  it('préfère l’orthographe la plus simple', () => {
    expect(spellChord(61, 'maj')).toEqual(['Db4', 'F4', 'Ab4']);
    expect(spellChord(63, 'dim')).toEqual(['D#4', 'F#4', 'A4']);
    expect(spellChord(68, 'aug')).toEqual(['Ab4', 'C5', 'E5']);
  });
});

describe('invert', () => {
  it('fait passer les notes graves à l’octave', () => {
    const c = chordNotes('C4', 'maj');
    expect(invert(c, 0)).toEqual(['C4', 'E4', 'G4']);
    expect(invert(c, 1)).toEqual(['E4', 'G4', 'C5']);
    expect(invert(c, 2)).toEqual(['G4', 'C5', 'E5']);
    expect(invert(chordNotes('C4', 'dom7'), 3)).toEqual(['Bb4', 'C5', 'E5', 'G5']);
  });

  it('refuse un renversement impossible', () => {
    expect(() => invert(chordNotes('C4', 'maj'), 3)).toThrow();
    expect(() => invert(chordNotes('C4', 'maj'), -1)).toThrow();
  });
});

describe('chordSymbol', () => {
  it('écrit les symboles français et internationaux', () => {
    expect(chordSymbol('C', 'maj')).toBe('Do');
    expect(chordSymbol('C', 'maj', 'en')).toBe('C');
    expect(chordSymbol('Eb', 'm7')).toBe('Mi♭m7');
    expect(chordSymbol('Eb', 'm7', 'en')).toBe('E♭m7');
    expect(chordSymbol('Bb', 'maj7')).toBe('Si♭7M');
    expect(chordSymbol('Bb', 'maj7', 'en')).toBe('B♭maj7');
    expect(chordSymbol('F#', 'm7b5')).toBe('Fa♯ø');
    expect(chordSymbol('F#', 'm7b5', 'en')).toBe('F♯m7♭5');
    expect(chordSymbol('G', 'dim7')).toBe('Sol°7');
    expect(chordSymbol('A', 'mmaj7', 'en')).toBe('Am(maj7)');
    expect(chordSymbol('D4', 'aug')).toBe('Ré+');
  });
});
