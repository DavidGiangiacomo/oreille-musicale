// Projections de progression (docs/DESIGN.md §7.4 et §10.5) : l'état des étapes
// et des compétences, recalculé à partir du seul journal. Rejouer le même journal
// donne toujours le même état ; corriger une règle suffit à tout recalculer.
import type { StepDef, StepPhase } from '../curriculum';
import type { CompetenceId } from '../exercise/competence';
import { competenceId } from '../exercise/families';
import type { Attempt, ProgressEvent } from '../journal';
import { isLapsed, type ReviewState } from '../srs';

export type StepStatus = 'locked' | 'available' | 'in_progress' | 'validated';

export interface StepState {
  id: string;
  status: StepStatus;
  /** Dernière phase commencée, ou null si l'étape n'a jamais été ouverte. */
  phase: StepPhase | null;
  /** Meilleure réussite à un test de l'étape, de 0 à 1. */
  bestScore: number | null;
  validatedAt: number | null;
  /** Dernier événement de l'étape. */
  lastActivityAt: number | null;
}

/** Ordre chronologique stable (à horodatage égal, par identifiant). */
function chronological<T extends { at: number; id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function projectSteps(
  steps: readonly StepDef[],
  events: readonly ProgressEvent[],
): Map<string, StepState> {
  const partial = new Map<string, Omit<StepState, 'status'> & { started: boolean }>();
  for (const step of steps) {
    partial.set(step.id, {
      id: step.id,
      phase: null,
      bestScore: null,
      validatedAt: null,
      lastActivityAt: null,
      started: false,
    });
  }
  for (const event of chronological(events)) {
    const state = partial.get(event.stepId);
    if (!state) continue; // étape retirée du curriculum
    state.started = true;
    state.lastActivityAt = event.at;
    if (event.type === 'phase_started') state.phase = event.phase;
    if (event.type === 'step_validated') state.validatedAt ??= event.at;
    if (event.type !== 'phase_started') {
      state.bestScore = Math.max(state.bestScore ?? 0, event.score);
    }
  }

  const states = new Map<string, StepState>();
  for (const step of steps) {
    const { started, ...state } = partial.get(step.id)!;
    const unlocked = step.requires.every((id) => partial.get(id)?.validatedAt != null);
    const status: StepStatus =
      state.validatedAt !== null
        ? 'validated'
        : !unlocked
          ? 'locked'
          : started
            ? 'in_progress'
            : 'available';
    states.set(step.id, { ...state, status, phase: status === 'validated' ? null : state.phase });
  }
  return states;
}

/**
 * Étape à travailler : la plus récemment commencée parmi celles en cours, sinon la
 * première disponible, lignes du haut d'abord (§8.7). Null si tout est validé.
 */
export function currentStep(
  steps: readonly StepDef[],
  states: ReadonlyMap<string, StepState>,
): StepDef | null {
  const inProgress = steps
    .filter((step) => states.get(step.id)?.status === 'in_progress')
    .sort(
      (a, b) => (states.get(b.id)?.lastActivityAt ?? 0) - (states.get(a.id)?.lastActivityAt ?? 0),
    );
  return (
    inProgress[0] ??
    [...steps]
      .sort((a, b) => a.row - b.row || a.column - b.column)
      .find((step) => states.get(step.id)?.status === 'available') ??
    null
  );
}

/**
 * Niveau de maîtrise (§7.4) : 0 non vue, 1 en apprentissage, 2 acquise, puis selon
 * la stabilité FSRS 3 consolidée (7 à 30 jours) et 4 maîtrisée (30 jours et plus).
 */
export type MasteryLevel = 0 | 1 | 2 | 3 | 4;

export const MASTERY_STABILITY_DAYS = { consolidated: 7, mastered: 30 } as const;

function reviewedLevel(review: ReviewState | undefined): MasteryLevel {
  if (!review) return 2;
  if (review.stability >= MASTERY_STABILITY_DAYS.mastered) return 4;
  return review.stability >= MASTERY_STABILITY_DAYS.consolidated ? 3 : 2;
}

export interface CompetenceState {
  id: CompetenceId;
  level: MasteryLevel;
  /** Ouverture de l'étape qui l'introduit. */
  introducedAt: number | null;
  attempts: number;
  /** 20 dernières réponses, de la plus ancienne à la plus récente. */
  recent: boolean[];
  /**
   * Acquise, mais dernière révision ratée, ou moins de 70 % sur les 10 dernières
   * réponses (5 au moins).
   */
  fragile: boolean;
  /** État de révision, dès l'entrée en révision. */
  review: ReviewState | null;
  /** Temps de réponse médian des bonnes réponses. */
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

export function projectCompetences(
  steps: readonly StepDef[],
  stepStates: ReadonlyMap<string, StepState>,
  events: readonly ProgressEvent[],
  attempts: readonly Attempt[],
  reviews: ReadonlyMap<string, ReviewState> = new Map(),
): Map<CompetenceId, CompetenceState> {
  const firstEvent = new Map<string, number>();
  for (const event of chronological(events)) {
    if (!firstEvent.has(event.stepId)) firstEvent.set(event.stepId, event.at);
  }
  const byCompetence = new Map<CompetenceId, Attempt[]>();
  for (const attempt of chronological(attempts)) {
    const list = byCompetence.get(attempt.competenceId) ?? [];
    list.push(attempt);
    byCompetence.set(attempt.competenceId, list);
  }

  const states = new Map<CompetenceId, CompetenceState>();
  for (const step of steps) {
    const stepState = stepStates.get(step.id);
    const validated = stepState?.status === 'validated';
    for (const item of step.newItems) {
      const id = competenceId(step.family, item, step.presentation);
      const review = reviews.get(id);
      const level: MasteryLevel = validated
        ? reviewedLevel(review)
        : firstEvent.has(step.id)
          ? 1
          : 0;
      const answered = byCompetence.get(id) ?? [];
      const lastTen = answered.slice(-10);
      const accuracy = lastTen.filter((a) => a.correct).length / Math.max(lastTen.length, 1);
      states.set(id, {
        id,
        level,
        introducedAt: firstEvent.get(step.id) ?? null,
        attempts: answered.length,
        recent: answered.slice(-20).map((a) => a.correct),
        fragile:
          level >= 2 &&
          ((review !== undefined && isLapsed(review)) || (lastTen.length >= 5 && accuracy < 0.7)),
        review: review ?? null,
        medianResponseTimeMs: median(
          answered.filter((a) => a.correct).map((a) => a.responseTimeMs),
        ),
      });
    }
  }
  return states;
}
