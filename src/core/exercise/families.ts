// Familles d'éléments (docs/DESIGN.md §6) : ce qui distingue intervalles, accords et
// renversements, derrière une interface commune au reste du cœur.
import type { Random } from '../random';
import {
  INTERVAL_CODES,
  INTERVALS,
  MODE_CODES,
  SCALE_CODES,
  type ChordQuality,
  type IntervalCode,
  type ModeCode,
  type ScaleCode,
} from '../theory';
import {
  CHORD_ORDER,
  chordSoundFrom,
  createChordQuestion,
  DEFAULT_BASS_RANGE,
  INVERSION_ANSWERS,
  inversionItem,
  isChordQuality,
  parseInversionItem,
  type ChordQuestion,
} from './chordQuestion';
import {
  createIntervalQuestion,
  DEFAULT_INTERVAL_RANGE,
  intervalSoundFrom,
  type IntervalQuestion,
} from './intervalQuestion';
import type { Difficulty, FamilyId, Generation, Sound } from './question';
import {
  createScaleQuestion,
  DEFAULT_TONIC_RANGE,
  isModeCode,
  isScaleCode,
  scaleSoundFrom,
  type ScaleQuestion,
} from './scaleQuestion';
import type {
  ChordPresentation,
  IntervalPresentation,
  ModePresentation,
  Presentation,
  ScalePresentation,
  Tempo,
} from './rendition';

export type Question = IntervalQuestion | ChordQuestion | ScaleQuestion;

export interface QuestionOptions {
  item: string;
  presentation: Presentation;
  /** Réponses proposées. */
  choices: readonly string[];
  random: Random;
  range?: readonly [number, number];
  tempo?: Tempo;
  /** Note de référence de la question précédente, à ne pas reprendre. */
  previousAnchor?: number | null;
}

export interface Family {
  id: FamilyId;
  presentations: readonly Presentation[];
  /** Toutes les réponses possibles, dans l'ordre fixe des boutons. */
  answerOrder: readonly string[];
  isItem(item: string): boolean;
  /** Réponse attendue quand `item` est joué. */
  answerOf(item: string): string;
  /** Écart entre deux réponses, pour trouver le voisin le plus proche. */
  distance(a: string, b: string): number;
  createQuestion(options: QuestionOptions): Question;
  /** Élément correspondant à `answer` dans le contexte de la question (écoute comparée). */
  itemFor(question: Question, answer: string): string;
  /** `item` joué depuis la même note de référence que la question. */
  soundFrom(question: Question, item: string): Sound;
  /** Élément à partir duquel jouer une comparaison de plusieurs éléments. */
  comparisonAnchor(items: readonly string[]): string;
  /** Registre et tempo selon la difficulté de l'entraînement (§7.5). */
  generationFor(base: Generation, difficulty: Difficulty): Generation;
  defaultRange: readonly [number, number];
}

function orderIndex(order: readonly string[], answer: string): number {
  const index = order.indexOf(answer);
  return index < 0 ? order.length : index;
}

const intervals: Family = {
  id: 'int',
  presentations: ['asc', 'desc', 'harm'],
  answerOrder: INTERVAL_CODES,
  isItem: (item) => (INTERVAL_CODES as readonly string[]).includes(item),
  answerOf: (item) => item,
  distance: (a, b) =>
    Math.abs(INTERVALS[a as IntervalCode].semitones - INTERVALS[b as IntervalCode].semitones),
  createQuestion: (options) =>
    createIntervalQuestion({
      item: options.item as IntervalCode,
      presentation: options.presentation as IntervalPresentation,
      choices: options.choices as IntervalCode[],
      random: options.random,
      ...(options.range ? { range: options.range } : {}),
      ...(options.tempo ? { tempo: options.tempo } : {}),
      previousFirstMidi: options.previousAnchor ?? null,
    }),
  itemFor: (_question, answer) => answer,
  soundFrom: (question, item) =>
    intervalSoundFrom(
      question.notes[0] as string,
      item as IntervalCode,
      question.presentation as IntervalPresentation,
      question.tempo,
    ),
  // La note de départ est choisie pour que l'intervalle le plus grand tienne dans le registre.
  comparisonAnchor: (items) =>
    items.reduce((a, b) =>
      INTERVALS[a as IntervalCode].semitones >= INTERVALS[b as IntervalCode].semitones ? a : b,
    ),
  generationFor: (base, difficulty) => {
    if (difficulty === 'easier') return { range: [55, 74], tempo: 'slow' };
    if (difficulty === 'harder') return { range: [48, 84], tempo: 'fast' };
    return base;
  },
  defaultRange: DEFAULT_INTERVAL_RANGE,
};

/** La basse reste au-dessus de C3 : en dessous, des voix serrées deviennent confuses (§6.5). */
function chordGeneration(base: Generation, difficulty: Difficulty): Generation {
  if (difficulty === 'easier') return { range: [50, 58], tempo: 'slow' };
  if (difficulty === 'harder') return { range: [48, 65], tempo: 'fast' };
  return base;
}

const chords: Family = {
  id: 'chd',
  presentations: ['arp', 'block', 'inv'],
  answerOrder: CHORD_ORDER,
  isItem: isChordQuality,
  answerOf: (item) => item,
  distance: (a, b) => Math.abs(orderIndex(CHORD_ORDER, a) - orderIndex(CHORD_ORDER, b)),
  createQuestion: (options) =>
    createChordQuestion({
      family: 'chd',
      item: options.item,
      presentation: options.presentation as ChordPresentation,
      choices: options.choices,
      random: options.random,
      ...(options.range ? { range: options.range } : {}),
      ...(options.tempo ? { tempo: options.tempo } : {}),
      previousAnchor: options.previousAnchor ?? null,
    }),
  itemFor: (_question, answer) => answer,
  soundFrom: (question, item) => {
    const chord = question as ChordQuestion;
    return chordSoundFrom(chord, item as ChordQuality, chord.inversion);
  },
  comparisonAnchor: (items) => items[0] as string,
  generationFor: chordGeneration,
  defaultRange: DEFAULT_BASS_RANGE,
};

const inversions: Family = {
  id: 'inv',
  presentations: ['block'],
  answerOrder: INVERSION_ANSWERS,
  isItem: (item) => parseInversionItem(item) !== null,
  answerOf: (item) => {
    const parsed = parseInversionItem(item);
    if (!parsed) throw new Error(`Élément de renversement inconnu : ${item}`);
    return INVERSION_ANSWERS[parsed.inversion] as string;
  },
  distance: (a, b) => Math.abs(orderIndex(INVERSION_ANSWERS, a) - orderIndex(INVERSION_ANSWERS, b)),
  createQuestion: (options) =>
    createChordQuestion({
      family: 'inv',
      item: options.item,
      presentation: 'block',
      choices: options.choices,
      random: options.random,
      ...(options.range ? { range: options.range } : {}),
      ...(options.tempo ? { tempo: options.tempo } : {}),
      previousAnchor: options.previousAnchor ?? null,
    }),
  itemFor: (question, answer) =>
    inversionItem(
      (question as ChordQuestion).quality,
      (INVERSION_ANSWERS as readonly string[]).indexOf(answer),
    ),
  soundFrom: (question, item) => {
    const parsed = parseInversionItem(item);
    if (!parsed) throw new Error(`Élément de renversement inconnu : ${item}`);
    return chordSoundFrom(question as ChordQuestion, parsed.quality, parsed.inversion);
  },
  comparisonAnchor: (items) => items[0] as string,
  generationFor: chordGeneration,
  defaultRange: DEFAULT_BASS_RANGE,
};

/** Gammes et modes : tonique entre C3 et C4 ; plus lent ou plus rapide selon la difficulté. */
function scaleGeneration(base: Generation, difficulty: Difficulty): Generation {
  if (difficulty === 'easier') return { range: base.range, tempo: 'slow' };
  if (difficulty === 'harder') return { range: base.range, tempo: 'fast' };
  return base;
}

function scaleFamily(id: 'scl' | 'mod'): Family {
  const order: readonly string[] = id === 'scl' ? SCALE_CODES : MODE_CODES;
  return {
    id,
    presentations: id === 'scl' ? ['updown', 'asc', 'desc'] : ['drone', 'plain', 'melody'],
    answerOrder: order,
    isItem: id === 'scl' ? isScaleCode : isModeCode,
    answerOf: (item) => item,
    distance: (a, b) => Math.abs(orderIndex(order, a) - orderIndex(order, b)),
    createQuestion: (options) =>
      createScaleQuestion({
        family: id,
        item: options.item,
        presentation: options.presentation as ScalePresentation | ModePresentation,
        choices: options.choices,
        random: options.random,
        ...(options.range ? { range: options.range } : {}),
        ...(options.tempo ? { tempo: options.tempo } : {}),
        previousAnchor: options.previousAnchor ?? null,
      }),
    itemFor: (_question, answer) => answer,
    soundFrom: (question, item) =>
      scaleSoundFrom(question as ScaleQuestion, item as ScaleCode | ModeCode),
    comparisonAnchor: (items) => items[0] as string,
    generationFor: scaleGeneration,
    defaultRange: DEFAULT_TONIC_RANGE,
  };
}

export const FAMILIES: Readonly<Record<FamilyId, Family>> = {
  int: intervals,
  chd: chords,
  inv: inversions,
  scl: scaleFamily('scl'),
  mod: scaleFamily('mod'),
};

export function familyOf(id: FamilyId): Family {
  return FAMILIES[id];
}

/** Réponses dans l'ordre des boutons, sans doublon. */
export function sortAnswers(family: FamilyId, answers: Iterable<string>): string[] {
  const set = new Set(answers);
  return FAMILIES[family].answerOrder.filter((answer) => set.has(answer));
}

/** Réponses proposées pour un ensemble d'éléments joués. */
export function answersFor(family: FamilyId, items: readonly string[]): string[] {
  return sortAnswers(
    family,
    items.map((item) => FAMILIES[family].answerOf(item)),
  );
}

/** Une question d'une famille. */
export function createQuestion(family: FamilyId, options: QuestionOptions): Question {
  return FAMILIES[family].createQuestion(options);
}

/** Identifiant d'une compétence : famille, élément, présentation (§7.1). */
export function competenceId(family: FamilyId, item: string, presentation: Presentation): string {
  return `${family}:${item}:${presentation}`;
}

export function parseCompetence(
  id: string,
): { family: FamilyId; item: string; presentation: Presentation } | null {
  const [family, item, presentation, ...rest] = id.split(':');
  if (rest.length > 0 || item === undefined || presentation === undefined) return null;
  const def = FAMILIES[family as FamilyId];
  if (!def || !def.isItem(item)) return null;
  if (!def.presentations.includes(presentation as Presentation)) return null;
  return { family: def.id, item, presentation: presentation as Presentation };
}
