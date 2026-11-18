import { Note } from 'tonal';

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Note orthographiée, en notation scientifique avec des altérations ASCII :
 * `'C4'` (do central), `'F#3'`, `'Bb5'`, `'F##3'`. Sans octave (`'Eb'`), c'est une
 * classe de hauteur, utile pour nommer une fondamentale ou une tonique.
 */
export type NoteName = string;

export interface NoteInfo {
  name: NoteName;
  letter: Letter;
  /** Altération, de -2 (double bémol) à +2 (double dièse). */
  alter: number;
  /** Octave scientifique : C4 est le do central. */
  octave: number;
  midi: number;
  /** Classe de hauteur : 0 pour do, 11 pour si. */
  pitchClass: number;
}

interface Spelling {
  letter: Letter;
  alter: number;
  octave: number | undefined;
}

function parse(name: NoteName): Spelling {
  const note = Note.get(name);
  if (note.empty) throw new Error(`Note invalide : « ${name} »`);
  return { letter: note.letter as Letter, alter: note.alt, octave: note.oct };
}

/** Décrit une note complète (avec octave). Lève une erreur si la note est invalide. */
export function noteInfo(name: NoteName): NoteInfo {
  const note = Note.get(name);
  if (note.empty || note.oct === undefined || note.midi === null) {
    throw new Error(`Note invalide ou sans octave : « ${name} »`);
  }
  return {
    name: note.name,
    letter: note.letter as Letter,
    alter: note.alt,
    octave: note.oct,
    midi: note.midi,
    pitchClass: note.chroma,
  };
}

export function midiOf(name: NoteName): number {
  return noteInfo(name).midi;
}

/** Retire l'octave : `'F#4'` → `'F#'`. */
export function pitchClassName(name: NoteName): NoteName {
  const { letter, alter } = parse(name);
  return letter + (alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter));
}

/** Rang de la lettre dans la gamme de do : C = 0 … B = 6. */
export function letterIndex(name: NoteName): number {
  return LETTERS.indexOf(parse(name).letter);
}

/** Nombre d'altérations d'une note (un double dièse en compte deux). */
export function accidentalsOf(name: NoteName): number {
  return Math.abs(parse(name).alter);
}

export type NoteNaming = 'fr' | 'en';

/**
 * Numérotation des octaves : française (do central = Do3, La3 = 440 Hz) ou
 * scientifique (do central = C4, A4 = 440 Hz).
 */
export type OctaveConvention = 'fr' | 'scientific';

export interface NoteFormat {
  naming?: NoteNaming;
  octave?: OctaveConvention | 'none';
}

const FRENCH_NAMES: Record<Letter, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

const ACCIDENTAL_SYMBOLS = new Map<number, string>([
  [-2, '♭♭'],
  [-1, '♭'],
  [0, ''],
  [1, '♯'],
  [2, '♯♯'],
]);

/**
 * Nom d'affichage d'une note : `formatNote('F#4')` donne `'Fa♯3'` (convention
 * française par défaut), `formatNote('F#4', { naming: 'en', octave: 'scientific' })`
 * donne `'F♯4'`, et `{ octave: 'none' }` donne `'Fa♯'`.
 */
export function formatNote(name: NoteName, format: NoteFormat = {}): string {
  const { naming = 'fr', octave = 'fr' } = format;
  const spelling = parse(name);
  const symbol = ACCIDENTAL_SYMBOLS.get(spelling.alter);
  if (symbol === undefined) throw new Error(`Altération non prise en charge : « ${name} »`);
  const base = (naming === 'fr' ? FRENCH_NAMES[spelling.letter] : spelling.letter) + symbol;
  if (octave === 'none') return base;
  if (spelling.octave === undefined) throw new Error(`Octave manquante : « ${name} »`);
  return base + String(octave === 'fr' ? spelling.octave - 1 : spelling.octave);
}
