import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { STEPS, type StepDef } from '../../core/curriculum';
import type { Attempt, ProgressEvent } from '../../core/journal';
import { activeTimeByDay, currentStreak, type Streak } from '../../core/progress/activity';
import { activeConfusions, confusionBoost, pendingDuels } from '../../core/progress/confusion';
import { currentStep, projectSteps, type StepState } from '../../core/progress/projection';
import {
  daysUntilDue,
  dueReviews,
  projectReviews,
  studyDay,
  type ReviewState,
} from '../../core/srs';
import type { IntervalCode } from '../../core/theory';
import { journal } from '../data';
import { useSettings } from '../settings/settingsContext';

export interface JournalData {
  events: ProgressEvent[];
  attempts: Attempt[];
  /** Heure de la lecture : l'instant de référence des projections (échéances, jour). */
  readAt: number;
}

/** Tout le journal, relu à chaque changement. Undefined pendant le premier chargement. */
export function useJournalData(): JournalData | undefined {
  return useLiveQuery(async () => {
    const [events, attempts] = await Promise.all([journal.events(), journal.attempts()]);
    return { events, attempts, readAt: Date.now() };
  }, []);
}

export interface DailyStatus {
  reviews: Map<string, ReviewState>;
  stepStates: Map<string, StepState>;
  /** Étape à travailler dans les parcours actifs. */
  current: StepDef | null;
  /** Compétences dues aujourd'hui. */
  dueCount: number;
  duelCount: number;
  /** Jours avant la prochaine révision quand rien n'est dû, sinon null. */
  nextDueInDays: number | null;
  todayActiveMs: number;
  goalMs: number;
  streak: Streak;
}

/** État du jour : révisions, duels, objectif et série, recalculés depuis le journal. */
export function useDailyStatus(): DailyStatus | undefined {
  const data = useJournalData();
  const { settings } = useSettings();
  return useMemo(() => {
    if (!data) return undefined;
    const now = data.readAt;
    const reviews = projectReviews(data.events, data.attempts);
    const stepStates = projectSteps(STEPS, data.events);
    const active = STEPS.filter((step) => settings.activeTracks.includes(step.track));
    const due = dueReviews(reviews, now);
    const activity = activeTimeByDay(data.attempts);
    const goalMs = settings.dailyGoalMinutes * 60_000;
    const upcoming = [...reviews.values()]
      .map((state) => daysUntilDue(state, now))
      .sort((a, b) => a - b);
    return {
      reviews,
      stepStates,
      current: currentStep(active, stepStates),
      dueCount: due.length,
      duelCount: pendingDuels(data.attempts, reviews, now).length,
      nextDueInDays: due.length === 0 ? (upcoming[0] ?? null) : null,
      todayActiveMs: activity.get(studyDay(now)) ?? 0,
      goalMs,
      streak: currentStreak(activity, goalMs, now),
    };
  }, [data, settings.activeTracks, settings.dailyGoalMinutes]);
}

/**
 * Renfort des paires confondues pour un contexte (« int:asc »), ou undefined
 * pendant le chargement.
 */
export function useConfusionBoost(context: string): Map<IntervalCode, number> | undefined {
  const data = useJournalData();
  return useMemo(() => {
    if (!data) return undefined;
    const boost = confusionBoost(activeConfusions(data.attempts, data.readAt), context);
    return boost as Map<IntervalCode, number>;
  }, [data, context]);
}
