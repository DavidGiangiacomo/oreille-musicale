import { randomInt, type Random } from '../random';
import {
  INTERVAL_CODES,
  INTERVALS,
  intervalNotes,
  midiOf,
  spellInterval,
  type IntervalCode,
  type NoteName,
} from '../theory';
import { intervalCompetenceId, type CompetenceId } from './competence';
import {
  intervalEvents,
  renditionDuration,
  type IntervalPresentation,
  type NoteEvent,
  type Tempo,
} from './rendition';

/**
 * Manière de répondre : boutons en v1. Le chant (`sung`) s'ajoutera en v2 sans
 * toucher à l'évaluation des questions (§11.7).
 */
export type AnswerType = 'choice';

/** Registre des premières étapes : F3 à F5 (§6.5). */
export const DEFAULT_INTERVAL_RANGE: readonly [number, number] = [53, 77];

/** Sons d'un intervalle : notes orthographiées, hauteurs MIDI et événements à jouer. */
export interface IntervalSound {
  /** Dans l'ordre d'écoute ; en harmonique, la plus grave d'abord. */
  notes: [NoteName, NoteName];
  midi: [number, number];
  events: NoteEvent[];
}

export interface IntervalQuestion extends IntervalSound {
  kind: 'interval';
  competenceId: CompetenceId;
  item: IntervalCode;
  presentation: IntervalPresentation;
  tempo: Tempo;
  /** Réponses proposées, dans l'ordre fixe des boutons (du plus petit au plus grand). */
  choices: IntervalCode[];
  answerType: AnswerType;
}

export interface IntervalQuestionOptions {
  item: IntervalCode;
  presentation: IntervalPresentation;
  choices: readonly IntervalCode[];
  random: Random;
  range?: readonly [number, number];
  tempo?: Tempo;
  /** Première note de la question précédente, à ne pas reprendre. */
  previousFirstMidi?: number | null;
}

/** Trie des intervalles dans l'ordre des boutons : par taille croissante. */
export function sortIntervals(items: readonly IntervalCode[]): IntervalCode[] {
  return INTERVAL_CODES.filter((code) => items.includes(code));
}

function soundOf(
  notes: [NoteName, NoteName],
  presentation: IntervalPresentation,
  tempo: Tempo,
): IntervalSound {
  const midi: [number, number] = [midiOf(notes[0]), midiOf(notes[1])];
  return { notes, midi, events: intervalEvents(midi[0], midi[1], presentation, tempo) };
}

/**
 * Le même intervalle « autre » joué depuis la même première note : sert à l'écoute
 * comparée du feedback (« ta réponse » contre « la bonne réponse »).
 */
export function intervalSoundFrom(
  first: NoteName,
  item: IntervalCode,
  presentation: IntervalPresentation,
  tempo: Tempo = 'normal',
): IntervalSound {
  return soundOf(
    intervalNotes(first, item, presentation === 'desc' ? 'down' : 'up'),
    presentation,
    tempo,
  );
}

/** Génère une question d'intervalle (§6.5). */
export function createIntervalQuestion(options: IntervalQuestionOptions): IntervalQuestion {
  const {
    item,
    presentation,
    random,
    range = DEFAULT_INTERVAL_RANGE,
    tempo = 'normal',
    previousFirstMidi = null,
  } = options;
  const choices = sortIntervals(options.choices);
  if (!choices.includes(item)) throw new Error(`« ${item} » ne fait pas partie des réponses`);

  const semitones = INTERVALS[item].semitones;
  const [low, high] = range;
  // La première note entendue est la plus aiguë en descendant, la plus grave sinon.
  const [min, max] = presentation === 'desc' ? [low + semitones, high] : [low, high - semitones];
  if (max < min) throw new Error(`Registre trop étroit pour « ${item} » : [${low}, ${high}]`);

  let first = randomInt(random, min, max);
  if (first === previousFirstMidi && max > min) {
    // Décale d'un demi-ton, en restant dans le registre.
    first = first === max ? first - 1 : first + 1;
  }

  const notes = spellInterval(first, item, presentation === 'desc' ? 'down' : 'up');
  return {
    kind: 'interval',
    competenceId: intervalCompetenceId(item, presentation),
    item,
    presentation,
    tempo,
    choices,
    answerType: 'choice',
    ...soundOf(notes, presentation, tempo),
  };
}

/** Pause entre deux sons d'une suite d'écoute. */
export const SEQUENCE_GAP = 0.7;

/** Enchaîne plusieurs sons en une seule réalisation, séparés par une pause. */
export function sequenceEvents(
  sounds: readonly IntervalSound[],
  gap: number = SEQUENCE_GAP,
): NoteEvent[] {
  const events: NoteEvent[] = [];
  let offset = 0;
  for (const sound of sounds) {
    for (const event of sound.events) events.push({ ...event, start: event.start + offset });
    offset += renditionDuration(sound.events) + gap;
  }
  return events;
}
