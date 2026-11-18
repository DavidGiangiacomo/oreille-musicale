import { formatNote, type NoteName, type NoteNaming } from './notes';
import { semitonesOf, transpose } from './intervals';
import { chooseSpelling, spellingsOf } from './spelling';

export const CHORD_QUALITIES = [
  'maj',
  'min',
  'dim',
  'aug',
  'sus4',
  'sus2',
  'dom7',
  'maj7',
  'm7',
  'm7b5',
  'dim7',
  'mmaj7',
  '7sus4',
] as const;

export type ChordQuality = (typeof CHORD_QUALITIES)[number];

export interface ChordDef {
  code: ChordQuality;
  family: 'triad' | 'seventh';
  /** Nom français, en minuscules : « accord parfait majeur ». */
  name: string;
  /** Suffixe de symbole en notation française : Do + « 7M » = Do7M. */
  suffixFr: string;
  /** Suffixe de symbole international : C + « maj7 » = Cmaj7. */
  suffixEn: string;
  /** Intervalles depuis la fondamentale, en notation tonal. */
  intervals: readonly string[];
  /** Mêmes intervalles, en demi-tons : [0, 4, 7] pour l'accord majeur. */
  semitones: readonly number[];
}

function def(
  code: ChordQuality,
  family: ChordDef['family'],
  name: string,
  suffixFr: string,
  suffixEn: string,
  intervals: readonly string[],
): ChordDef {
  return {
    code,
    family,
    name,
    suffixFr,
    suffixEn,
    intervals,
    semitones: intervals.map(semitonesOf),
  };
}

export const CHORDS: Readonly<Record<ChordQuality, ChordDef>> = {
  maj: def('maj', 'triad', 'accord parfait majeur', '', '', ['1P', '3M', '5P']),
  min: def('min', 'triad', 'accord parfait mineur', 'm', 'm', ['1P', '3m', '5P']),
  dim: def('dim', 'triad', 'accord de quinte diminuée', '°', 'dim', ['1P', '3m', '5d']),
  aug: def('aug', 'triad', 'accord de quinte augmentée', '+', 'aug', ['1P', '3M', '5A']),
  sus4: def('sus4', 'triad', 'accord suspendu (quarte)', 'sus4', 'sus4', ['1P', '4P', '5P']),
  sus2: def('sus2', 'triad', 'accord suspendu (seconde)', 'sus2', 'sus2', ['1P', '2M', '5P']),
  dom7: def('dom7', 'seventh', 'septième de dominante', '7', '7', ['1P', '3M', '5P', '7m']),
  maj7: def('maj7', 'seventh', 'septième majeure', '7M', 'maj7', ['1P', '3M', '5P', '7M']),
  m7: def('m7', 'seventh', 'mineur septième', 'm7', 'm7', ['1P', '3m', '5P', '7m']),
  m7b5: def('m7b5', 'seventh', 'demi-diminué', 'ø', 'm7♭5', ['1P', '3m', '5d', '7m']),
  dim7: def('dim7', 'seventh', 'septième diminuée', '°7', 'dim7', ['1P', '3m', '5d', '7d']),
  mmaj7: def('mmaj7', 'seventh', 'mineur septième majeure', 'm7M', 'm(maj7)', [
    '1P',
    '3m',
    '5P',
    '7M',
  ]),
  '7sus4': def('7sus4', 'seventh', 'septième suspendue', '7sus4', '7sus4', [
    '1P',
    '4P',
    '5P',
    '7m',
  ]),
};

/** Notes d'un accord à l'état fondamental, en position serrée. */
export function chordNotes(root: NoteName, quality: ChordQuality): NoteName[] {
  return CHORDS[quality].intervals.map((interval) => transpose(root, interval));
}

/** Accord à partir d'une hauteur MIDI de fondamentale, orthographié au mieux. */
export function spellChord(rootMidi: number, quality: ChordQuality): NoteName[] {
  return chooseSpelling(
    spellingsOf(rootMidi).map((root) => chordNotes(root, quality)),
    (notes) => notes,
  );
}

/**
 * Renversement d'un accord en position serrée : les notes les plus graves passent
 * à l'octave supérieure. `invert(['C4', 'E4', 'G4'], 1)` donne `['E4', 'G4', 'C5']`.
 */
export function invert(notes: readonly NoteName[], inversion: number): NoteName[] {
  if (!Number.isInteger(inversion) || inversion < 0 || inversion >= notes.length) {
    throw new Error(`Renversement impossible : ${inversion} pour ${notes.length} notes`);
  }
  return [
    ...notes.slice(inversion),
    ...notes.slice(0, inversion).map((note) => transpose(note, '8P')),
  ];
}

/** Symbole d'accord : `chordSymbol('Eb', 'm7')` donne « Mi♭m7 », en anglais « E♭m7 ». */
export function chordSymbol(
  root: NoteName,
  quality: ChordQuality,
  naming: NoteNaming = 'fr',
): string {
  const chord = CHORDS[quality];
  const suffix = naming === 'fr' ? chord.suffixFr : chord.suffixEn;
  return formatNote(root, { naming, octave: 'none' }) + suffix;
}
