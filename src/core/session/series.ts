// Série de questions d'intervalles (jalon J1) : fonctions pures qui font avancer
// l'état d'une série. Les étapes, révisions et séance du jour (J2, J3) s'appuieront
// sur ce même déroulé question → réponse → feedback.
import {
  createIntervalQuestion,
  DEFAULT_INTERVAL_RANGE,
  sortIntervals,
  type IntervalQuestion,
} from '../exercise/intervalQuestion';
import type { IntervalPresentation, Tempo } from '../exercise/rendition';
import { selectNextItem } from '../exercise/selection';
import type { Question } from '../exercise/families';
import type { Random } from '../random';
import type { IntervalCode } from '../theory';

export interface SeriesConfig {
  /** Intervalles proposés (au moins un). */
  items: IntervalCode[];
  presentation: IntervalPresentation;
  /** Nombre de questions. */
  length: number;
  tempo: Tempo;
  range: readonly [number, number];
  /** Renfort des paires confondues dans les tirages (§8.6). */
  boost?: ReadonlyMap<IntervalCode, number>;
}

export const DEFAULT_SERIES_LENGTH = 20;

export interface AnswerMetrics {
  /** Temps entre la fin de la première écoute et la réponse. */
  responseTimeMs: number;
  /** Nombre de réécoutes avant de répondre. */
  replays: number;
  /** Aide utilisée avant de répondre (« écouter arpégé »). */
  helpUsed?: boolean;
}

export interface QuestionResult extends AnswerMetrics {
  answer: string;
  correct: boolean;
  helpUsed: boolean;
}

/** Une question et sa réponse, quelle que soit la famille. */
export interface AnsweredQuestion {
  question: Question;
  result: QuestionResult | null;
}

export interface SeriesEntry {
  question: IntervalQuestion;
  result: QuestionResult | null;
}

export type SeriesStatus = 'asking' | 'feedback' | 'finished';

export interface SeriesState {
  config: SeriesConfig;
  entries: SeriesEntry[];
  status: SeriesStatus;
}

export function createSeriesConfig(
  items: readonly IntervalCode[],
  presentation: IntervalPresentation,
  overrides: Partial<Omit<SeriesConfig, 'items' | 'presentation'>> = {},
): SeriesConfig {
  const sorted = sortIntervals(items);
  if (sorted.length === 0) throw new Error('Une série demande au moins un intervalle');
  const length = overrides.length ?? DEFAULT_SERIES_LENGTH;
  if (!Number.isInteger(length) || length < 1) throw new Error(`Longueur invalide : ${length}`);
  return {
    items: sorted,
    presentation,
    length,
    tempo: overrides.tempo ?? 'normal',
    range: overrides.range ?? DEFAULT_INTERVAL_RANGE,
    ...(overrides.boost ? { boost: overrides.boost } : {}),
  };
}

function nextEntry(config: SeriesConfig, entries: readonly SeriesEntry[], random: Random) {
  const history = entries.map(({ question, result }) => ({
    item: question.item,
    correct: result ? result.correct : null,
  }));
  const previous = entries.at(-1)?.question;
  const question = createIntervalQuestion({
    item: selectNextItem(config.items, history, random, { boost: config.boost }),
    presentation: config.presentation,
    choices: config.items,
    range: config.range,
    tempo: config.tempo,
    previousFirstMidi: previous ? previous.midi[0] : null,
    random,
  });
  return { question, result: null };
}

export function startSeries(config: SeriesConfig, random: Random): SeriesState {
  return { config, entries: [nextEntry(config, [], random)], status: 'asking' };
}

export function currentEntry(state: SeriesState): SeriesEntry {
  const entry = state.entries.at(-1);
  if (!entry) throw new Error('Série vide');
  return entry;
}

/** Résultat d'une réponse à une question. */
export function evaluateAnswer(
  question: Question,
  answer: string,
  metrics: AnswerMetrics,
): QuestionResult {
  if (!(question.choices as readonly string[]).includes(answer)) {
    throw new Error(`Réponse « ${answer} » hors des choix proposés`);
  }
  return {
    answer,
    correct: answer === question.answer,
    responseTimeMs: Math.max(0, Math.round(metrics.responseTimeMs)),
    replays: metrics.replays,
    helpUsed: metrics.helpUsed ?? false,
  };
}

/** Enregistre la réponse à la question en cours et passe au feedback. */
export function answerCurrent(
  state: SeriesState,
  answer: string,
  metrics: AnswerMetrics,
): SeriesState {
  if (state.status !== 'asking') throw new Error('Aucune question en attente de réponse');
  const entry = currentEntry(state);
  const result = evaluateAnswer(entry.question, answer, metrics);
  return {
    ...state,
    entries: [...state.entries.slice(0, -1), { ...entry, result }],
    status: 'feedback',
  };
}

/** Après le feedback : question suivante, ou fin de la série. */
export function advance(state: SeriesState, random: Random): SeriesState {
  if (state.status !== 'feedback') throw new Error('Pas de feedback en cours');
  if (state.entries.length >= state.config.length) return { ...state, status: 'finished' };
  return {
    ...state,
    entries: [...state.entries, nextEntry(state.config, state.entries, random)],
    status: 'asking',
  };
}

export interface ItemSummary {
  item: IntervalCode;
  correct: number;
  total: number;
}

export interface SeriesSummary {
  correct: number;
  total: number;
  /** Par intervalle, dans l'ordre des boutons ; seuls les intervalles posés figurent. */
  byItem: ItemSummary[];
  /** Temps de réponse médian des bonnes réponses, ou null s'il n'y en a pas. */
  medianResponseTimeMs: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : Math.round(((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
}

export function seriesSummary(state: SeriesState): SeriesSummary {
  const answered = state.entries.filter(
    (entry): entry is SeriesEntry & { result: QuestionResult } => entry.result !== null,
  );
  const byItem = state.config.items
    .map((item) => {
      const asked = answered.filter((entry) => entry.question.item === item);
      return {
        item,
        correct: asked.filter((entry) => entry.result.correct).length,
        total: asked.length,
      };
    })
    .filter((summary) => summary.total > 0);
  return {
    correct: answered.filter((entry) => entry.result.correct).length,
    total: answered.length,
    byItem,
    medianResponseTimeMs: median(
      answered.filter((entry) => entry.result.correct).map((entry) => entry.result.responseTimeMs),
    ),
  };
}
