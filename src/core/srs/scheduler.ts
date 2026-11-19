// Planification FSRS (docs/DESIGN.md §8.1), via ts-fsrs, encapsulée ici.
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type Grade as FsrsGrade,
} from 'ts-fsrs';
import type { Grade } from './grade';
import { daysBetween, studyDay } from './time';

/** Rétention visée : 90 % de chances de se souvenir au moment de la révision. */
export const TARGET_RETENTION = 0.9;

// Sans « fuzz » (planification déterministe, donc recalculable à l'identique) ni
// étapes intra-journée : la répétition dans la journée est le rôle des séances.
const scheduler = fsrs(
  generatorParameters({
    request_retention: TARGET_RETENTION,
    enable_fuzz: false,
    enable_short_term: false,
  }),
);

export interface ReviewEntry {
  at: number;
  grade: Grade;
  /** Entrée en révision à la validation d'une étape, ou révision. */
  source: 'validation' | 'review';
}

/** État de révision d'une compétence. */
export interface ReviewState {
  competenceId: string;
  /** Échéance (ms). */
  due: number;
  /** Stabilité FSRS, en jours. */
  stability: number;
  lapses: number;
  lastReviewAt: number;
  lastGrade: Grade;
  history: ReviewEntry[];
  /** Carte ts-fsrs, détail d'implémentation. */
  card: Card;
}

function next(card: Card, at: number, grade: Grade): Card {
  return scheduler.next(card, new Date(at), grade as FsrsGrade).card;
}

function stateFrom(competenceId: string, card: Card, history: ReviewEntry[]): ReviewState {
  const last = history.at(-1) as ReviewEntry;
  return {
    competenceId,
    due: card.due.getTime(),
    stability: card.stability,
    lapses: card.lapses,
    lastReviewAt: last.at,
    lastGrade: last.grade,
    history,
    card,
  };
}

/** Entrée en révision d'une compétence. */
export function enterReview(competenceId: string, at: number, grade: Grade): ReviewState {
  const card = next(createEmptyCard(new Date(at)), at, grade);
  return stateFrom(competenceId, card, [{ at, grade, source: 'validation' }]);
}

/** Applique une révision notée. */
export function applyReview(state: ReviewState, at: number, grade: Grade): ReviewState {
  const card = next(state.card, at, grade);
  return stateFrom(state.competenceId, card, [...state.history, { at, grade, source: 'review' }]);
}

/** Due le jour d'étude de `at` (ou en retard). */
export function isDue(state: ReviewState, at: number): boolean {
  return studyDay(state.due) <= studyDay(at);
}

/** Jours d'étude restant avant l'échéance (négatif en cas de retard). */
export function daysUntilDue(state: ReviewState, at: number): number {
  return daysBetween(studyDay(at), studyDay(state.due));
}

/** Probabilité estimée de se souvenir à l'instant `at`. */
export function retrievability(state: ReviewState, at: number): number {
  return scheduler.get_retrievability(state.card, new Date(at), false);
}
