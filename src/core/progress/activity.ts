// Temps de pratique active, objectif quotidien et série (docs/DESIGN.md §9.4).
import type { Attempt } from '../journal';
import { daysBetween, shiftDay, studyDay } from '../srs/time';

/** Au-delà d'une minute sans répondre, c'est une pause : elle ne compte pas. */
export const MAX_ACTIVE_GAP_MS = 60_000;
/** Temps compté pour la réponse qui suit une pause (écoute et réponse). */
export const RESUME_CREDIT_MS = 10_000;

export const DEFAULT_DAILY_GOAL_MINUTES = 10;
export const DAILY_GOAL_CHOICES = [5, 10, 15, 20, 30] as const;

/**
 * Pratique active par jour d'étude, en millisecondes : l'écart entre deux réponses
 * compte s'il ne dépasse pas une minute ; après une pause, la réponse compte pour
 * 10 secondes.
 */
export function activeTimeByDay(attempts: readonly Attempt[]): Map<string, number> {
  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  const days = new Map<string, number>();
  let previous: Attempt | null = null;
  for (const attempt of sorted) {
    const day = studyDay(attempt.at);
    const gap = previous && studyDay(previous.at) === day ? attempt.at - previous.at : Infinity;
    const credit = gap <= MAX_ACTIVE_GAP_MS ? gap : RESUME_CREDIT_MS;
    days.set(day, (days.get(day) ?? 0) + credit);
    previous = attempt;
  }
  return days;
}

/** Jours de repos tolérés : un par période de 7 jours. */
const REST_PERIOD_DAYS = 7;

export interface Streak {
  /** Jours d'affilée avec objectif atteint (les jours de repos ne comptent pas, sans casser la série). */
  days: number;
  /** Objectif atteint aujourd'hui. */
  today: boolean;
}

/**
 * Série en cours (§9.4) : on remonte depuis aujourd'hui (ou hier, si la journée n'est
 * pas finie) tant que l'objectif est atteint ; un jour manqué est un jour de repos
 * s'il n'y en a pas d'autre dans les 7 jours, sinon la série s'arrête.
 */
export function currentStreak(
  activeMs: ReadonlyMap<string, number>,
  goalMs: number,
  at: number,
): Streak {
  const reached = (day: string) => (activeMs.get(day) ?? 0) >= goalMs;
  const today = studyDay(at);
  const reachedDays = [...activeMs.keys()].filter(reached).sort();
  const first = reachedDays[0];
  if (!first) return { days: 0, today: false };

  let days = 0;
  let lastRest: string | null = null;
  let day = reached(today) ? today : shiftDay(today, -1);
  while (daysBetween(first, day) >= 0) {
    if (reached(day)) {
      days += 1;
    } else {
      const restAllowed = lastRest === null || daysBetween(day, lastRest) >= REST_PERIOD_DAYS;
      // Deux jours manqués de suite, ou un repos de trop : fin de la série.
      if (!restAllowed || !reached(shiftDay(day, -1))) break;
      lastRest = day;
    }
    day = shiftDay(day, -1);
  }
  return { days, today: reached(today) };
}
