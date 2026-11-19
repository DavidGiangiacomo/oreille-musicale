// Questions d'accords (docs/DESIGN.md §6.2 et §6.5) : reconnaître la qualité d'un
// accord, ou son renversement.
import { randomInt, type Random } from '../random';
import {
  CHORD_QUALITIES,
  CHORDS,
  invert,
  midiOf,
  spellChord,
  type ChordQuality,
  type NoteName,
} from '../theory';
import type { QuestionBase, Sound } from './question';
import { chordEvents, type ChordPresentation, type Tempo } from './rendition';

/** Basse des accords en position serrée : entre C3 et C4 (§6.5). */
export const DEFAULT_BASS_RANGE: readonly [number, number] = [48, 60];

/** Ordre fixe des boutons : triades puis septièmes, dans l'ordre d'apparition. */
export const CHORD_ORDER: readonly ChordQuality[] = CHORD_QUALITIES;

/** Suspendus : leurs renversements s'entendent comme d'autres accords (§6.2). */
const SUSPENDED: readonly ChordQuality[] = ['sus4', 'sus2', '7sus4'];
/** Symétriques : leurs renversements sont indiscernables. */
const SYMMETRIC: readonly ChordQuality[] = ['aug', 'dim7'];

/** Accords reconnaissables en position renversée (présentation `inv`). */
export function recognizableInversed(quality: ChordQuality): boolean {
  return !SUSPENDED.includes(quality);
}

/** Accords dont on peut identifier le renversement (parcours Renversements). */
export function invertible(quality: ChordQuality): boolean {
  return !SUSPENDED.includes(quality) && !SYMMETRIC.includes(quality);
}

export function isChordQuality(value: string): value is ChordQuality {
  return (CHORD_QUALITIES as readonly string[]).includes(value);
}

/** Réponses du parcours Renversements : état fondamental, puis 1er, 2e, 3e renversement. */
export const INVERSION_ANSWERS = ['inv0', 'inv1', 'inv2', 'inv3'] as const;
export type InversionAnswer = (typeof INVERSION_ANSWERS)[number];

/** Élément du parcours Renversements : un accord dans un renversement, « maj.1 ». */
export function inversionItem(quality: ChordQuality, inversion: number): string {
  return `${quality}.${inversion}`;
}

export function parseInversionItem(
  item: string,
): { quality: ChordQuality; inversion: number } | null {
  const [quality, inversion, ...rest] = item.split('.');
  if (rest.length > 0 || quality === undefined || !isChordQuality(quality)) return null;
  const k = Number(inversion);
  if (!Number.isInteger(k) || k < 0 || k >= CHORDS[quality].semitones.length) return null;
  return invertible(quality) ? { quality, inversion: k } : null;
}

export function inversionAnswer(inversion: number): InversionAnswer {
  const answer = INVERSION_ANSWERS[inversion];
  if (!answer) throw new Error(`Renversement inconnu : ${inversion}`);
  return answer;
}

/** Un accord réalisé : position serrée, renversement obtenu par rotation. */
export interface ChordVoicing {
  notes: NoteName[];
  midi: number[];
  root: NoteName;
  rootMidi: number;
}

/**
 * Accord en position serrée dont la basse est `bassMidi` : on calcule la
 * fondamentale, on orthographie l'accord, puis on fait passer à l'octave
 * supérieure les notes sous la basse.
 */
export function voiceChord(
  quality: ChordQuality,
  bassMidi: number,
  inversion: number,
): ChordVoicing {
  const semitones = CHORDS[quality].semitones;
  const offset = semitones[inversion];
  if (offset === undefined) throw new Error(`Renversement impossible : ${quality}, ${inversion}`);
  return voiceFromRoot(quality, bassMidi - offset, inversion);
}

/** Même chose depuis la fondamentale : sert à comparer deux accords sur la même fondamentale. */
export function voiceFromRoot(
  quality: ChordQuality,
  rootMidi: number,
  inversion: number,
): ChordVoicing {
  const rootPosition = spellChord(rootMidi, quality);
  const notes = invert(rootPosition, inversion);
  return { notes, midi: notes.map(midiOf), root: rootPosition[0] as NoteName, rootMidi };
}

export interface ChordQuestion extends QuestionBase {
  family: 'chd' | 'inv';
  presentation: ChordPresentation;
  quality: ChordQuality;
  /** 0 à l'état fondamental, 1 au 1er renversement… */
  inversion: number;
  root: NoteName;
  rootMidi: number;
}

export interface ChordQuestionOptions {
  family: 'chd' | 'inv';
  item: string;
  presentation: ChordPresentation;
  choices: readonly string[];
  random: Random;
  /** Registre de la basse. */
  range?: readonly [number, number];
  tempo?: Tempo;
  /** Basse de la question précédente, à ne pas reprendre. */
  previousAnchor?: number | null;
}

function soundOf(voicing: ChordVoicing, presentation: ChordPresentation, tempo: Tempo): Sound {
  return {
    notes: voicing.notes,
    midi: voicing.midi,
    events: chordEvents(voicing.midi, presentation === 'arp', tempo),
  };
}

/** Qualité et renversement joués pour un élément de la famille. */
function chordOf(
  family: 'chd' | 'inv',
  item: string,
  presentation: ChordPresentation,
  random: Random,
): { quality: ChordQuality; inversion: number; answer: string } {
  if (family === 'inv') {
    const parsed = parseInversionItem(item);
    if (!parsed) throw new Error(`Élément de renversement inconnu : ${item}`);
    return { ...parsed, answer: inversionAnswer(parsed.inversion) };
  }
  if (!isChordQuality(item)) throw new Error(`Accord inconnu : ${item}`);
  if (presentation === 'inv' && !recognizableInversed(item)) {
    throw new Error(`« ${item} » ne se reconnaît pas en position renversée`);
  }
  // En plaqué renversé, n'importe quel renversement, état fondamental compris.
  const inversion =
    presentation === 'inv' ? randomInt(random, 0, CHORDS[item].semitones.length - 1) : 0;
  return { quality: item, inversion, answer: item };
}

/** Génère une question d'accord : qualité (`chd`) ou renversement (`inv`). */
export function createChordQuestion(options: ChordQuestionOptions): ChordQuestion {
  const {
    family,
    item,
    presentation,
    random,
    range = DEFAULT_BASS_RANGE,
    tempo = 'normal',
    previousAnchor = null,
  } = options;
  const { quality, inversion, answer } = chordOf(family, item, presentation, random);
  if (!options.choices.includes(answer)) {
    throw new Error(`« ${answer} » ne fait pas partie des réponses`);
  }

  const [low, high] = range;
  let bass = randomInt(random, low, high);
  if (bass === previousAnchor && high > low) bass = bass === high ? bass - 1 : bass + 1;
  const voicing = voiceChord(quality, bass, inversion);

  return {
    family,
    competenceId: `${family}:${item}:${presentation}`,
    item,
    answer,
    presentation,
    tempo,
    choices: [...options.choices],
    answerType: 'choice',
    anchor: bass,
    quality,
    inversion,
    root: voicing.root,
    rootMidi: voicing.rootMidi,
    ...soundOf(voicing, presentation, tempo),
  };
}

/**
 * Un autre accord joué sur la même fondamentale, pour l'écoute comparée : une autre
 * qualité dans le même renversement (ramené au dernier possible), ou le même accord
 * dans un autre renversement.
 */
export function chordSoundFrom(
  question: ChordQuestion,
  quality: ChordQuality,
  inversion: number,
): Sound {
  const last = CHORDS[quality].semitones.length - 1;
  const voicing = voiceFromRoot(quality, question.rootMidi, Math.min(inversion, last));
  return soundOf(voicing, question.presentation, question.tempo);
}

/** L'accord de la question joué arpégé : l'aide « écouter arpégé » (§9.2). */
export function arpeggiatedEvents(question: ChordQuestion) {
  return chordEvents(question.midi, true, question.tempo);
}
