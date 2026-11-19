// Questions de gammes et de modes (docs/DESIGN.md §6.3 à §6.5) : gamme montante et
// descendante, modes sur bourdon ou sans, mélodies modales.
import { randomInt, weightedPick, type Random } from '../random';
import {
  accidentalCount,
  hasDoubleAccidental,
  MODE_CODES,
  MODES,
  SCALE_CODES,
  SCALES,
  scaleNotes,
  semitonesOf,
  spellingsOf,
  midiOf,
  type ModeCode,
  type NoteName,
  type ScaleCode,
} from '../theory';
import type { QuestionBase, Sound } from './question';
import {
  DEFAULT_VELOCITY,
  TEMPO_FACTORS,
  type ModePresentation,
  type NoteEvent,
  type ScalePresentation,
  type Tempo,
} from './rendition';

/** Tonique entre C3 et C4 (§6.5). */
export const DEFAULT_TONIC_RANGE: readonly [number, number] = [48, 60];

/** Durées au tempo normal (§6.5). */
export const SCALE_TIMING = {
  /** Une note de gamme. */
  note: 0.3,
  /** Tenue de la dernière note. */
  lastNote: 1,
  /** Le bourdon commence avant la première note. */
  droneLead: 1,
  /** Temps d'une mélodie modale. */
  beat: 0.5,
  /** Tenue de la dernière note d'une mélodie, en temps. */
  finalBeats: 3,
} as const;

/** Le bourdon, synthétique et tenu, est nettement plus doux que la gamme. */
export const DRONE_VELOCITY = 0.35;

export function isScaleCode(value: string): value is ScaleCode {
  return (SCALE_CODES as readonly string[]).includes(value);
}

export function isModeCode(value: string): value is ModeCode {
  return (MODE_CODES as readonly string[]).includes(value);
}

/** Sa descente classique se confond avec la mineure naturelle : pas de gamme descendante seule. */
export function playableScale(code: ScaleCode, presentation: ScalePresentation): boolean {
  return !(code === 'melmin' && presentation === 'desc');
}

const intervalsOf = (code: ScaleCode | ModeCode) =>
  isScaleCode(code) ? SCALES[code].intervals : MODES[code as ModeCode].intervals;

/**
 * Orthographe de la tonique : celle qui donne le moins d'altérations sur toutes les
 * gammes jouées (la mineure mélodique monte en mélodique et descend en naturelle).
 */
function spellTonic(tonicMidi: number, codes: readonly (ScaleCode | ModeCode)[]): NoteName {
  let best: NoteName | undefined;
  let bestScore = Infinity;
  for (const tonic of spellingsOf(tonicMidi)) {
    const notes = codes.flatMap((code) => scaleNotes(tonic, code));
    const score = accidentalCount(notes) + (hasDoubleAccidental(notes) ? 100 : 0);
    if (score < bestScore) {
      best = tonic;
      bestScore = score;
    }
  }
  if (!best) throw new Error(`Tonique impossible : ${tonicMidi}`);
  return best;
}

/** Degrés de la gamme à partir de la tonique, de la tonique à l'octave. */
export function scaleDegrees(
  tonicMidi: number,
  code: ScaleCode | ModeCode,
): { tonic: NoteName; degrees: NoteName[] } {
  const codes: (ScaleCode | ModeCode)[] = code === 'melmin' ? ['melmin', 'natmin'] : [code];
  const tonic = spellTonic(tonicMidi, codes);
  return { tonic, degrees: scaleNotes(tonic, code) };
}

/** Notes jouées d'une gamme selon la présentation, dans l'ordre d'écoute. */
export function scaleSequence(
  tonicMidi: number,
  code: ScaleCode | ModeCode,
  presentation: ScalePresentation | 'updown',
): NoteName[] {
  const { tonic, degrees } = scaleDegrees(tonicMidi, code);
  // Mineure mélodique classique : elle redescend en mineure naturelle.
  const descent = [...(code === 'melmin' ? scaleNotes(tonic, 'natmin') : degrees)].reverse();
  if (presentation === 'asc') return degrees;
  if (presentation === 'desc') return descent;
  return [...degrees, ...descent.slice(1)];
}

/** Bourdon : la tonique doublée à l'octave inférieure, tenue sous toute la réalisation. */
function droneEvents(tonicMidi: number, duration: number): NoteEvent[] {
  return [tonicMidi - 12, tonicMidi].map((midi) => ({
    midi,
    start: 0,
    duration,
    velocity: DRONE_VELOCITY,
    instrument: 'drone',
  }));
}

/** Notes d'une suite à durées données, décalées de `offset` secondes. */
function melodicEvents(midi: readonly number[], durations: readonly number[], offset: number) {
  const events: NoteEvent[] = [];
  let time = offset;
  midi.forEach((note, i) => {
    const duration = durations[i] as number;
    events.push({ midi: note, start: time, duration: duration * 0.95, velocity: DEFAULT_VELOCITY });
    time += duration;
  });
  return { events, end: time };
}

// ——— Mélodies modales (§6.5, point 7) ———

/**
 * Degrés à faire entendre au moins deux fois dans une mélodie : la note
 * caractéristique, ou, pour les modes de référence, celles qui les distinguent de
 * leurs voisins (ionien : 4J et 7M ; éolien : 2M et 6m).
 */
export const MELODY_FOCUS: Readonly<Record<ModeCode, readonly string[]>> = {
  lydian: ['4A'],
  ionian: ['4P', '7M'],
  mixolydian: ['7m'],
  dorian: ['6M'],
  aeolian: ['2M', '6m'],
  phrygian: ['2m'],
  locrian: ['2m', '5d'],
};

export interface ModalMelody {
  /** Degrés joués : 0 pour la tonique, 7 pour son octave. */
  steps: number[];
  /** Durées, en temps. */
  beats: number[];
}

/** Degrés (0 à 6) des notes à faire entendre d'un mode. */
export function focusDegrees(code: ModeCode): number[] {
  return MELODY_FOCUS[code].map((interval) => MODES[code].intervals.indexOf(interval));
}

/** Demi-tons d'un degré de 0 (tonique) à 7 (octave). */
function degreeSemitones(code: ModeCode, step: number): number {
  return step === 7 ? 12 : semitonesOf(MODES[code].intervals[step] as string);
}

/** Écarts à une mélodie modale : vide si elle respecte toutes les contraintes. */
export function melodyIssues(code: ModeCode, melody: ModalMelody): string[] {
  const { steps, beats } = melody;
  const issues: string[] = [];
  if (steps.length < 8 || steps.length > 12) issues.push('longueur');
  if (beats.length !== steps.length) issues.push('rythme');
  if (steps[0] !== 0) issues.push('début');
  if (steps.at(-1) !== 0 && steps.at(-1) !== 7) issues.push('fin');
  let conjunct = 0;
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1] as number;
    const b = steps[i] as number;
    if (a === b) issues.push('répétition');
    if (Math.abs(a - b) === 1) conjunct += 1;
    if (Math.abs(degreeSemitones(code, a) - degreeSemitones(code, b)) > 7) issues.push('saut');
  }
  if (conjunct < 0.6 * (steps.length - 1)) issues.push('degrés conjoints');
  for (const degree of focusDegrees(code)) {
    if (steps.filter((step) => step % 7 === degree).length < 2) issues.push('note caractéristique');
  }
  return issues;
}

function tryMelody(code: ModeCode, random: Random): ModalMelody {
  const focus = focusDegrees(code);
  const length = randomInt(random, 8, 12);
  const steps = [0];
  for (let i = 1; i < length; i++) {
    const current = steps[i - 1] as number;
    const remaining = length - i;
    const candidates: number[] = [];
    const weights: number[] = [];
    for (let move = -4; move <= 4; move++) {
      const next = current + move;
      if (move === 0 || next < 0 || next > 7) continue;
      if (Math.abs(degreeSemitones(code, next) - degreeSemitones(code, current)) > 7) continue;
      // Dernière note : la tonique ou son octave ; l'avant-dernière ne l'est pas, pour
      // pouvoir y arriver sans répéter la note.
      if (remaining === 1 && next !== 0 && next !== 7) continue;
      if (remaining === 2 && (next === 0 || next === 7)) continue;
      candidates.push(next);
      const step = Math.abs(move) === 1 ? 6 : 1;
      weights.push(step * (focus.includes(next % 7) ? 2.5 : 1));
    }
    steps.push(weightedPick(random, candidates, weights));
  }
  const beats = steps.map((_, i) =>
    i === steps.length - 1 ? SCALE_TIMING.finalBeats : i > 0 && random.next() < 0.2 ? 2 : 1,
  );
  return { steps, beats };
}

/** Mélodie modale de 8 à 12 notes qui respecte toutes les contraintes du §6.5. */
export function modalMelody(code: ModeCode, random: Random): ModalMelody {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const melody = tryMelody(code, random);
    if (melodyIssues(code, melody).length === 0) return melody;
  }
  throw new Error(`Aucune mélodie trouvée pour le mode ${code}`);
}

// ——— Questions ———

export interface ScaleQuestion extends QuestionBase {
  family: 'scl' | 'mod';
  presentation: ScalePresentation | ModePresentation;
  code: ScaleCode | ModeCode;
  tonic: NoteName;
  tonicMidi: number;
  /** Notes de la gamme, de la tonique à l'octave : pour le clavier du feedback. */
  degrees: NoteName[];
  /** Mélodie modale jouée, ou null. */
  melody: ModalMelody | null;
}

export interface ScaleQuestionOptions {
  family: 'scl' | 'mod';
  item: string;
  presentation: ScalePresentation | ModePresentation;
  choices: readonly string[];
  random: Random;
  /** Registre de la tonique. */
  range?: readonly [number, number];
  tempo?: Tempo;
  /** Tonique de la question précédente, à ne pas reprendre. */
  previousAnchor?: number | null;
}

/** Réalisation d'une gamme ou d'un mode sur une tonique : notes jouées et événements. */
export function scaleRealization(
  family: 'scl' | 'mod',
  code: ScaleCode | ModeCode,
  tonicMidi: number,
  presentation: ScalePresentation | ModePresentation,
  tempo: Tempo,
  melody: ModalMelody | null,
): Sound & { tonic: NoteName; degrees: NoteName[] } {
  const factor = TEMPO_FACTORS[tempo];
  const { tonic, degrees } = scaleDegrees(tonicMidi, code);
  const withDrone = family === 'mod' && presentation !== 'plain';
  const offset = withDrone ? SCALE_TIMING.droneLead * factor : 0;

  let notes: NoteName[];
  let durations: number[];
  if (presentation === 'melody') {
    if (!melody) throw new Error('Mélodie manquante');
    notes = melody.steps.map((step) => degrees[step] as NoteName);
    durations = melody.beats.map((beats) => beats * SCALE_TIMING.beat * factor);
  } else {
    const shape = family === 'mod' ? 'updown' : (presentation as ScalePresentation);
    notes = scaleSequence(tonicMidi, code, shape);
    durations = notes.map((_, i) =>
      i === notes.length - 1 ? SCALE_TIMING.lastNote * factor : SCALE_TIMING.note * factor,
    );
  }
  const midi = notes.map(midiOf);
  const { events, end } = melodicEvents(midi, durations, offset);
  return {
    notes,
    midi,
    events: withDrone ? [...droneEvents(tonicMidi, end), ...events] : events,
    tonic,
    degrees,
  };
}

/** Génère une question de gamme (`scl`) ou de mode (`mod`). */
export function createScaleQuestion(options: ScaleQuestionOptions): ScaleQuestion {
  const {
    family,
    item,
    presentation,
    random,
    range = DEFAULT_TONIC_RANGE,
    tempo = 'normal',
    previousAnchor = null,
  } = options;
  if (family === 'scl' ? !isScaleCode(item) : !isModeCode(item)) {
    throw new Error(`Élément inconnu : ${family}:${item}`);
  }
  if (family === 'scl' && !playableScale(item as ScaleCode, presentation as ScalePresentation)) {
    throw new Error(`« ${item} » ne se joue pas en ${presentation}`);
  }
  if (!options.choices.includes(item)) {
    throw new Error(`« ${item} » ne fait pas partie des réponses`);
  }

  const [low, high] = range;
  let tonicMidi = randomInt(random, low, high);
  if (tonicMidi === previousAnchor && high > low) {
    tonicMidi = tonicMidi === high ? tonicMidi - 1 : tonicMidi + 1;
  }
  const code = item as ScaleCode | ModeCode;
  const melody = presentation === 'melody' ? modalMelody(code as ModeCode, random) : null;
  const realization = scaleRealization(family, code, tonicMidi, presentation, tempo, melody);

  return {
    family,
    competenceId: `${family}:${item}:${presentation}`,
    item,
    answer: item,
    presentation,
    tempo,
    choices: [...options.choices],
    answerType: 'choice',
    anchor: tonicMidi,
    code,
    tonicMidi,
    melody,
    ...realization,
  };
}

/**
 * Une autre gamme ou un autre mode sur la même tonique, pour l'écoute comparée ; en
 * mélodie, la même mélodie (mêmes degrés, même rythme) dans l'autre mode.
 */
export function scaleSoundFrom(question: ScaleQuestion, code: ScaleCode | ModeCode): Sound {
  const presentation =
    question.family === 'scl' && !playableScale(code as ScaleCode, question.presentation as 'desc')
      ? 'updown'
      : question.presentation;
  const { notes, midi, events } = scaleRealization(
    question.family,
    code,
    question.tonicMidi,
    presentation,
    question.tempo,
    question.melody,
  );
  return { notes, midi, events };
}

/** Notes caractéristiques d'un mode sur la tonique de la question (§6.3). */
export function characteristicNotes(question: ScaleQuestion): NoteName[] {
  if (question.family !== 'mod') return [];
  const mode = MODES[question.code as ModeCode];
  return mode.characteristic.map(
    (interval) => question.degrees[mode.intervals.indexOf(interval)] as NoteName,
  );
}

/** Nombre de notes distinctes d'une gamme (5 à 7) : un indice légitime. */
export function noteCount(code: ScaleCode | ModeCode): number {
  return intervalsOf(code).length;
}
