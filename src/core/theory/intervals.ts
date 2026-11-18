import { Interval, Note } from 'tonal';
import type { NoteName } from './notes';
import { chooseSpelling, spellingsOf } from './spelling';

export const INTERVAL_CODES = [
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'TT',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
  'P8',
] as const;

export type IntervalCode = (typeof INTERVAL_CODES)[number];

export type Direction = 'up' | 'down';

export interface IntervalDef {
  code: IntervalCode;
  semitones: number;
  /** Nom français, en minuscules : « tierce mineure ». */
  name: string;
  /** Abréviation française : « 3m », « 4J », « 4+/5− ». */
  abbreviation: string;
  /** Écritures possibles, en notation tonal (« 3m », « 4A », « 5d »…). */
  spellings: readonly string[];
}

function def(
  code: IntervalCode,
  semitones: number,
  name: string,
  abbreviation: string,
  spellings: readonly string[],
): IntervalDef {
  return { code, semitones, name, abbreviation, spellings };
}

export const INTERVALS: Readonly<Record<IntervalCode, IntervalDef>> = {
  m2: def('m2', 1, 'seconde mineure', '2m', ['2m']),
  M2: def('M2', 2, 'seconde majeure', '2M', ['2M']),
  m3: def('m3', 3, 'tierce mineure', '3m', ['3m']),
  M3: def('M3', 4, 'tierce majeure', '3M', ['3M']),
  P4: def('P4', 5, 'quarte juste', '4J', ['4P']),
  TT: def('TT', 6, 'triton', '4+/5−', ['4A', '5d']),
  P5: def('P5', 7, 'quinte juste', '5J', ['5P']),
  m6: def('m6', 8, 'sixte mineure', '6m', ['6m']),
  M6: def('M6', 9, 'sixte majeure', '6M', ['6M']),
  m7: def('m7', 10, 'septième mineure', '7m', ['7m']),
  M7: def('M7', 11, 'septième majeure', '7M', ['7M']),
  P8: def('P8', 12, 'octave', '8J', ['8P']),
};

/** Transpose une note d'un intervalle écrit en notation tonal (« 3m », « 4A »…). */
export function transpose(note: NoteName, interval: string, direction: Direction = 'up'): NoteName {
  const result = Note.transpose(note, direction === 'up' ? interval : `-${interval}`);
  if (!result) throw new Error(`Transposition impossible : ${note} ${direction} ${interval}`);
  return result;
}

/** Nombre de demi-tons d'un intervalle écrit en notation tonal. */
export function semitonesOf(interval: string): number {
  const semitones = Interval.get(interval).semitones;
  if (semitones === undefined || Number.isNaN(semitones)) {
    throw new Error(`Intervalle invalide : « ${interval} »`);
  }
  return semitones;
}

/**
 * Libellé français d'un intervalle écrit en notation tonal :
 * « 4P » → « 4J », « 4A » → « 4+ », « 5d » → « 5− », « 6M » → « 6M ».
 */
export function frenchIntervalLabel(interval: string): string {
  const { num, q } = Interval.get(interval);
  const quality = { P: 'J', A: '+', d: '−', M: 'M', m: 'm' }[q as string];
  if (quality === undefined) throw new Error(`Intervalle non pris en charge : « ${interval} »`);
  return `${num}${quality}`;
}

/**
 * Les deux notes d'un intervalle à partir de la première, la seconde étant
 * orthographiée au mieux (le triton s'écrit 4+ ou 5− selon le cas).
 */
export function intervalNotes(
  first: NoteName,
  code: IntervalCode,
  direction: Direction,
): [NoteName, NoteName] {
  const second = chooseSpelling(
    INTERVALS[code].spellings.map((spelling) => transpose(first, spelling, direction)),
    (note) => [note],
  );
  return [first, second];
}

/**
 * Intervalle complet à partir d'une hauteur MIDI : choisit aussi l'orthographe de
 * la première note (Do♯ → Mi plutôt que Ré♭ → Fa♭ pour une 3m).
 */
export function spellInterval(
  firstMidi: number,
  code: IntervalCode,
  direction: Direction,
): [NoteName, NoteName] {
  return chooseSpelling(
    spellingsOf(firstMidi).map((first) => intervalNotes(first, code, direction)),
    (pair) => pair,
  );
}
