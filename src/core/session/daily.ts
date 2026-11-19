// Séance du jour (docs/DESIGN.md §8.7) : révisions dues, duels en attente, puis
// l'étape d'un parcours actif. L'appli décide quoi travailler.
import type { StepDef } from '../curriculum';
import type { Attempt } from '../journal';
import { activeConfusions, confusionBoost, pendingDuels } from '../progress/confusion';
import { currentStep, type StepState } from '../progress/projection';
import type { Random } from '../random';
import type { ReviewState } from '../srs';
import { planDuel, planReview, type QuestionBlock, type ReviewPlan } from './review';

export const DAILY = {
  /** Duels par séance au plus. */
  maxDuels: 2,
  /** Durée moyenne d'une question, écoute et feedback compris (s). */
  reviewQuestionSeconds: 9,
  /** Un duel prend plus de temps : écoute comparée après chaque réponse. */
  duelQuestionSeconds: 14,
} as const;

export interface DailyPlan {
  review: ReviewPlan;
  duels: QuestionBlock[];
  /** Blocs de questions, dans l'ordre : révisions puis duels. */
  blocks: QuestionBlock[];
  /** Étape à travailler ensuite, ou null si tout est validé. */
  step: StepDef | null;
  /** Durée estimée des révisions et des duels, en minutes. */
  estimatedMinutes: number;
}

export interface DailyInput {
  reviews: ReadonlyMap<string, ReviewState>;
  /** Réponses récentes (60 jours au moins), pour les confusions. */
  attempts: readonly Attempt[];
  /** Étapes des parcours actifs. */
  steps: readonly StepDef[];
  stepStates: ReadonlyMap<string, StepState>;
  at: number;
  random: Random;
}

export function planDailySession(input: DailyInput): DailyPlan {
  const { reviews, attempts, steps, stepStates, at, random } = input;
  const confusions = activeConfusions(attempts, at);
  const review = planReview(reviews, at, random, {
    boost: (context) => confusionBoost(confusions, context),
  });
  const duels = pendingDuels(attempts, reviews, at)
    .slice(0, DAILY.maxDuels)
    .map((duel) => planDuel(duel, random));
  const seconds =
    review.blocks.reduce((sum, block) => sum + block.plan.length, 0) * DAILY.reviewQuestionSeconds +
    duels.reduce((sum, block) => sum + block.plan.length, 0) * DAILY.duelQuestionSeconds;
  return {
    review,
    duels,
    blocks: [...review.blocks, ...duels],
    step: currentStep(steps, stepStates),
    estimatedMinutes: Math.ceil(seconds / 60),
  };
}
