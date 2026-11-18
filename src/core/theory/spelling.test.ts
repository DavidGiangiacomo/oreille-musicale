import { describe, expect, it } from 'vitest';
import { CHORD_QUALITIES, spellChord } from './chords';
import { INTERVAL_CODES, spellInterval } from './intervals';
import { MODE_CODES, SCALE_CODES, spellScale } from './scales';
import {
  accidentalCount,
  chooseSpelling,
  hasDoubleAccidental,
  ROOT_SPELLINGS,
  spellingsOf,
} from './spelling';

describe('spellingsOf', () => {
  it('propose les orthographes usuelles d’une hauteur', () => {
    expect(spellingsOf(60)).toEqual(['C4']);
    expect(spellingsOf(61)).toEqual(['Db4', 'C#4']);
    expect(spellingsOf(66)).toEqual(['F#4', 'Gb4']);
    expect(spellingsOf(47)).toEqual(['B2']);
  });

  it('écarte Mi♯, Fa♭, Si♯ et Do♭ comme fondamentales', () => {
    const all = ROOT_SPELLINGS.flat();
    for (const excluded of ['E#', 'Fb', 'B#', 'Cb']) expect(all).not.toContain(excluded);
  });

  it('refuse une hauteur non entière', () => {
    expect(() => spellingsOf(60.5)).toThrow();
  });
});

describe('chooseSpelling', () => {
  it('retient le moins d’altérations, et le premier candidat à égalité', () => {
    expect(chooseSpelling(['a', 'b'], (c) => (c === 'a' ? ['C#4'] : ['C4']))).toBe('b');
    expect(chooseSpelling(['a', 'b'], (c) => (c === 'a' ? ['C#4'] : ['Db4']))).toBe('a');
  });

  it('évite les doubles altérations', () => {
    expect(accidentalCount(['C#4', 'Bb4', 'F##3'])).toBe(4);
    expect(hasDoubleAccidental(['C4', 'F##3'])).toBe(true);
    expect(
      chooseSpelling(['double', 'simple'], (c) =>
        c === 'double' ? ['F##3'] : ['G#3', 'A#3', 'D#4'],
      ),
    ).toBe('simple');
  });
});

describe('orthographe de tout le contenu musical', () => {
  it('n’a de double altération que là où aucune autre fondamentale n’existe', () => {
    const doubles: string[] = [];
    for (let midi = 60; midi < 72; midi++) {
      for (const code of INTERVAL_CODES) {
        for (const direction of ['up', 'down'] as const) {
          const notes = spellInterval(midi, code, direction);
          if (hasDoubleAccidental(notes)) doubles.push(`intervalle ${code} ${notes.join(' ')}`);
        }
      }
      for (const quality of CHORD_QUALITIES) {
        const notes = spellChord(midi, quality);
        if (hasDoubleAccidental(notes)) doubles.push(`accord ${quality} ${notes.join(' ')}`);
      }
      for (const code of [...SCALE_CODES, ...MODE_CODES]) {
        const notes = spellScale(midi, code);
        if (hasDoubleAccidental(notes)) doubles.push(`gamme ${code} ${notes.join(' ')}`);
      }
    }
    // Do°7, Fa°7 et Si+ n'ont qu'une fondamentale possible : la double altération
    // y est l'écriture correcte.
    expect(doubles).toEqual([
      'accord dim7 C4 Eb4 Gb4 Bbb4',
      'accord dim7 F4 Ab4 Cb5 Ebb5',
      'accord aug B4 D#5 F##5',
    ]);
  });
});
