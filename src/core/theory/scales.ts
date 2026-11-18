import type { NoteName } from './notes';
import { semitonesOf, transpose } from './intervals';
import { chooseSpelling, spellingsOf } from './spelling';

export const SCALE_CODES = [
  'major',
  'natmin',
  'harmin',
  'melmin',
  'pentmaj',
  'pentmin',
  'blues',
] as const;

/** Modes de la gamme majeure, du plus lumineux au plus sombre (ordre des boutons). */
export const MODE_CODES = [
  'lydian',
  'ionian',
  'mixolydian',
  'dorian',
  'aeolian',
  'phrygian',
  'locrian',
] as const;

export type ScaleCode = (typeof SCALE_CODES)[number];
export type ModeCode = (typeof MODE_CODES)[number];

export interface ScaleDef {
  code: ScaleCode | ModeCode;
  /** Nom français, en minuscules : « mineure harmonique », « dorien ». */
  name: string;
  /** Degrés depuis la tonique, en notation tonal, sans l'octave. */
  intervals: readonly string[];
  /** Mêmes degrés en demi-tons : [0, 2, 4, 5, 7, 9, 11] pour la gamme majeure. */
  semitones: readonly number[];
}

export interface ModeDef extends ScaleDef {
  code: ModeCode;
  family: 'majeure' | 'mineure' | 'diminuée';
  /** Mode de référence auquel on le compare, ou null pour l'ionien et l'éolien. */
  reference: 'ionian' | 'aeolian' | null;
  /** Degrés qui le distinguent de sa référence, en notation tonal (« 6M » pour le dorien). */
  characteristic: readonly string[];
}

function scale(code: ScaleCode, name: string, intervals: readonly string[]): ScaleDef {
  return { code, name, intervals, semitones: intervals.map(semitonesOf) };
}

function mode(
  code: ModeCode,
  name: string,
  family: ModeDef['family'],
  reference: ModeDef['reference'],
  characteristic: readonly string[],
  intervals: readonly string[],
): ModeDef {
  return {
    code,
    name,
    family,
    reference,
    characteristic,
    intervals,
    semitones: intervals.map(semitonesOf),
  };
}

const MAJOR = ['1P', '2M', '3M', '4P', '5P', '6M', '7M'];
const NATURAL_MINOR = ['1P', '2M', '3m', '4P', '5P', '6m', '7m'];

export const SCALES: Readonly<Record<ScaleCode, ScaleDef>> = {
  major: scale('major', 'majeure', MAJOR),
  natmin: scale('natmin', 'mineure naturelle', NATURAL_MINOR),
  harmin: scale('harmin', 'mineure harmonique', ['1P', '2M', '3m', '4P', '5P', '6m', '7M']),
  // Forme ascendante ; la descente classique (en mineure naturelle) relève de la génération.
  melmin: scale('melmin', 'mineure mélodique', ['1P', '2M', '3m', '4P', '5P', '6M', '7M']),
  pentmaj: scale('pentmaj', 'pentatonique majeure', ['1P', '2M', '3M', '5P', '6M']),
  pentmin: scale('pentmin', 'pentatonique mineure', ['1P', '3m', '4P', '5P', '7m']),
  blues: scale('blues', 'blues', ['1P', '3m', '4P', '5d', '5P', '7m']),
};

export const MODES: Readonly<Record<ModeCode, ModeDef>> = {
  lydian: mode(
    'lydian',
    'lydien',
    'majeure',
    'ionian',
    ['4A'],
    ['1P', '2M', '3M', '4A', '5P', '6M', '7M'],
  ),
  ionian: mode('ionian', 'ionien', 'majeure', null, [], MAJOR),
  mixolydian: mode(
    'mixolydian',
    'mixolydien',
    'majeure',
    'ionian',
    ['7m'],
    ['1P', '2M', '3M', '4P', '5P', '6M', '7m'],
  ),
  dorian: mode(
    'dorian',
    'dorien',
    'mineure',
    'aeolian',
    ['6M'],
    ['1P', '2M', '3m', '4P', '5P', '6M', '7m'],
  ),
  aeolian: mode('aeolian', 'éolien', 'mineure', null, [], NATURAL_MINOR),
  phrygian: mode(
    'phrygian',
    'phrygien',
    'mineure',
    'aeolian',
    ['2m'],
    ['1P', '2m', '3m', '4P', '5P', '6m', '7m'],
  ),
  locrian: mode(
    'locrian',
    'locrien',
    'diminuée',
    'aeolian',
    ['2m', '5d'],
    ['1P', '2m', '3m', '4P', '5d', '6m', '7m'],
  ),
};

function definition(code: ScaleCode | ModeCode): ScaleDef {
  return code in SCALES ? SCALES[code as ScaleCode] : MODES[code as ModeCode];
}

/** Gamme ascendante depuis la tonique, octave supérieure comprise. */
export function scaleNotes(tonic: NoteName, code: ScaleCode | ModeCode): NoteName[] {
  return [...definition(code).intervals, '8P'].map((interval) => transpose(tonic, interval));
}

/** Gamme à partir d'une hauteur MIDI de tonique, orthographiée au mieux. */
export function spellScale(tonicMidi: number, code: ScaleCode | ModeCode): NoteName[] {
  return chooseSpelling(
    spellingsOf(tonicMidi).map((tonic) => scaleNotes(tonic, code)),
    (notes) => notes,
  );
}
