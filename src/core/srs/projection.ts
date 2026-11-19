// Cartes de révision recalculées depuis le journal (docs/DESIGN.md §8 et §10.5).
// Aucune révision n'est enregistrée telle quelle : elles se déduisent des
// validations d'étape et des réponses, si bien qu'une règle de notation corrigée
// s'applique rétroactivement.
import type { Attempt, ProgressEvent } from '../journal';
import {
  ANSWERS_PER_REVIEW,
  autoGrade,
  entryGrade,
  referenceTimeMs,
  type AnswerSample,
} from './grade';
import { applyReview, enterReview, isDue, retrievability, type ReviewState } from './scheduler';
import { studyDay } from './time';

/** Contexte de réponse d'une compétence (§8.4) : famille et présentation, « int:asc ». */
export function contextOf(competenceId: string): string {
  const [family, , presentation] = competenceId.split(':');
  return `${family}:${presentation}`;
}

type TimelineItem =
  | { at: number; order: number; event: ProgressEvent }
  | { at: number; order: number; attempt: Attempt };

const REFERENCE_WINDOW = 50;

/**
 * Rejoue le journal dans l'ordre chronologique :
 * - à la validation d'une étape, chaque nouvelle compétence entre en révision avec
 *   une note tirée de sa réussite au test (§8.2) ;
 * - une compétence due qui reçoit 3 réponses le même jour d'étude, quelle que soit
 *   l'activité (révision, étape, entraînement libre, duel), est révisée avec la
 *   note calculée sur ces 3 réponses (§8.3, et révisions implicites §8.5).
 */
export function projectReviews(
  events: readonly ProgressEvent[],
  attempts: readonly Attempt[],
): Map<string, ReviewState> {
  // À instant égal, les réponses passent avant les événements (le test précède sa validation).
  const timeline: TimelineItem[] = [
    ...attempts.map((attempt) => ({ at: attempt.at, order: 0, attempt })),
    ...events.map((event) => ({ at: event.at, order: 1, event })),
  ].sort((a, b) => a.at - b.at || a.order - b.order);

  const states = new Map<string, ReviewState>();
  const pending = new Map<string, { day: string; samples: AnswerSample[] }>();
  const correctTimes = new Map<string, number[]>();
  const testRuns = new Map<string, Attempt[]>();

  for (const item of timeline) {
    if ('event' in item) {
      const { event } = item;
      if (event.type === 'phase_started' && event.phase === 'test') testRuns.set(event.stepId, []);
      if (event.type === 'step_validated') {
        const run = testRuns.get(event.stepId) ?? [];
        for (const id of event.competenceIds) {
          if (states.has(id)) continue;
          const asked = run.filter((attempt) => attempt.competenceId === id);
          const accuracy =
            asked.length === 0
              ? 1
              : asked.filter((attempt) => attempt.correct).length / asked.length;
          states.set(id, enterReview(id, event.at, entryGrade(accuracy)));
        }
      }
      continue;
    }

    const { attempt } = item;
    if (attempt.activity === 'test' && attempt.stepId) testRuns.get(attempt.stepId)?.push(attempt);

    const context = contextOf(attempt.competenceId);
    const references = correctTimes.get(context) ?? [];
    const state = states.get(attempt.competenceId);
    if (state && attempt.at > state.lastReviewAt && isDue(state, attempt.at)) {
      const day = studyDay(attempt.at);
      const current = pending.get(attempt.competenceId);
      const collector = current && current.day === day ? current : { day, samples: [] };
      collector.samples.push({
        correct: attempt.correct,
        responseTimeMs: attempt.responseTimeMs,
        replays: attempt.replays,
        helpUsed: attempt.helpUsed,
      });
      if (collector.samples.length >= ANSWERS_PER_REVIEW) {
        const grade = autoGrade(collector.samples, referenceTimeMs(references));
        states.set(attempt.competenceId, applyReview(state, attempt.at, grade));
        pending.delete(attempt.competenceId);
      } else {
        pending.set(attempt.competenceId, collector);
      }
    }
    if (attempt.correct) {
      correctTimes.set(context, [...references, attempt.responseTimeMs].slice(-REFERENCE_WINDOW));
    }
  }
  return states;
}

/** Une compétence est fragile après un oubli, jusqu'à sa prochaine révision réussie. */
export function isLapsed(state: ReviewState): boolean {
  return state.lastGrade === 1;
}

/**
 * Compétences dues le jour de `at`, dans l'ordre où les réviser : les fragiles
 * d'abord, puis celles dont le souvenir est le plus menacé (§8.4).
 */
export function dueReviews(states: ReadonlyMap<string, ReviewState>, at: number): ReviewState[] {
  return [...states.values()]
    .filter((state) => isDue(state, at))
    .map((state) => ({ state, r: retrievability(state, at) }))
    .sort(
      (a, b) =>
        Number(isLapsed(b.state)) - Number(isLapsed(a.state)) ||
        a.r - b.r ||
        a.state.competenceId.localeCompare(b.state.competenceId),
    )
    .map(({ state }) => state);
}
