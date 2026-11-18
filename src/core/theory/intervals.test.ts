import { Interval } from 'tonal';
import { describe, expect, it } from 'vitest';
import {
  INTERVAL_CODES,
  INTERVALS,
  frenchIntervalLabel,
  intervalNotes,
  spellInterval,
  transpose,
} from './intervals';
import { midiOf } from './notes';
import { spellingsOf } from './spelling';

const ROOT_MIDIS = Array.from({ length: 12 }, (_, i) => 60 + i);
const ALL_ROOTS = ROOT_MIDIS.flatMap(spellingsOf);

describe('INTERVALS', () => {
  it('couvre les 12 intervalles simples, de la seconde mineure à l’octave', () => {
    expect(INTERVAL_CODES.map((code) => INTERVALS[code].semitones)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('utilise les abréviations françaises du document de conception', () => {
    expect(INTERVAL_CODES.map((code) => INTERVALS[code].abbreviation)).toEqual([
      '2m',
      '2M',
      '3m',
      '3M',
      '4J',
      '4+/5−',
      '5J',
      '6m',
      '6M',
      '7m',
      '7M',
      '8J',
    ]);
  });

  it('a des écritures cohérentes avec le nombre de demi-tons', () => {
    for (const code of INTERVAL_CODES) {
      for (const spelling of INTERVALS[code].spellings) {
        expect(Interval.get(spelling).semitones).toBe(INTERVALS[code].semitones);
      }
    }
  });
});

describe('intervalNotes', () => {
  it.each(INTERVAL_CODES)(
    'écrit correctement %s dans les deux sens, depuis toute fondamentale',
    (code) => {
      const { semitones, spellings } = INTERVALS[code];
      for (const first of ALL_ROOTS) {
        const [up1, up2] = intervalNotes(first, code, 'up');
        expect(midiOf(up2) - midiOf(up1)).toBe(semitones);
        expect(spellings).toContain(Interval.distance(up1, up2));

        const [down1, down2] = intervalNotes(first, code, 'down');
        expect(midiOf(down1) - midiOf(down2)).toBe(semitones);
        expect(spellings.map((s) => `-${s}`)).toContain(Interval.distance(down1, down2));
      }
    },
  );

  it('écrit le triton en 4+ ou en 5− selon ce qui demande le moins d’altérations', () => {
    expect(intervalNotes('C4', 'TT', 'up')).toEqual(['C4', 'F#4']);
    expect(intervalNotes('F4', 'TT', 'up')).toEqual(['F4', 'B4']);
    expect(intervalNotes('F#4', 'TT', 'up')).toEqual(['F#4', 'C5']);
  });
});

describe('spellInterval', () => {
  it("choisit l'orthographe de la première note", () => {
    expect(spellInterval(61, 'm3', 'up')).toEqual(['C#4', 'E4']);
    expect(spellInterval(61, 'M3', 'up')).toEqual(['Db4', 'F4']);
    expect(spellInterval(60, 'm3', 'up')).toEqual(['C4', 'Eb4']);
  });

  it('respecte le sens et le nombre de demi-tons', () => {
    for (const midi of ROOT_MIDIS) {
      for (const code of INTERVAL_CODES) {
        const [a, b] = spellInterval(midi, code, 'down');
        expect(midiOf(a)).toBe(midi);
        expect(midiOf(b)).toBe(midi - INTERVALS[code].semitones);
      }
    }
  });
});

describe('transpose et frenchIntervalLabel', () => {
  it('transpose vers le haut et vers le bas', () => {
    expect(transpose('C4', '3m')).toBe('Eb4');
    expect(transpose('C4', '3m', 'down')).toBe('A3');
    expect(() => transpose('X4', '3m')).toThrow();
  });

  it('traduit les qualités d’intervalle en notation française', () => {
    expect(['4P', '4A', '5d', '6M', '7m', '8P', '2m'].map(frenchIntervalLabel)).toEqual([
      '4J',
      '4+',
      '5−',
      '6M',
      '7m',
      '8J',
      '2m',
    ]);
  });
});
