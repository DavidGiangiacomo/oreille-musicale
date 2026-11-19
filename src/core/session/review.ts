// Séance de révision et duels (docs/DESIGN.md §8.4 et §8.6) : quelles questions
// poser, dans quel ordre. Les notes se déduisent ensuite du journal (core/srs).
import { STEPS } from '../curriculum';
import {
  answersFor,
  createQuestion,
  FAMILIES,
  parseCompetence,
  sortAnswers,
  type Question,
} from '../exercise/families';
import { FAMILY_IDS, type FamilyId, type Generation } from '../exercise/question';
import type { Presentation } from '../exercise/rendition';
import { DUEL_LENGTH, type Duel } from '../progress/confusion';
import type { Random } from '../random';
import { ANSWERS_PER_REVIEW, dueReviews, type ReviewState } from '../srs';
import { arrange, spread } from './plan';

export const REVIEW = {
  /** Compétences dues révisées par séance au plus (§8.4). */
  maxDue: 8,
  /** Part des questions « distractrices » dans un bloc. */
  distractorShare: 0.3,
} as const;

/** Une suite de questions aux réponses homogènes : même famille, même présentation. */
export interface QuestionBlock {
  kind: 'review' | 'duel';
  /** « int:asc », « chd:block ». */
  context: string;
  family: FamilyId;
  presentation: Presentation;
  /** Réponses proposées, dans l'ordre des boutons. */
  choices: string[];
  /** Éléments à réviser (révision) ou les deux du duel. */
  focus: string[];
  /** Éléments joués, dans l'ordre. */
  plan: string[];
  generation: Generation;
}

export interface ReviewPlan {
  blocks: QuestionBlock[];
  /** Compétences dues dans cette séance. */
  dueIds: string[];
  /** Compétences dues reportées à une prochaine séance (retard étalé). */
  postponed: number;
}

/** Registre et tempo d'un contexte : ceux de ses étapes. */
function generationOf(family: FamilyId, presentation: Presentation): Generation {
  const step = STEPS.find((s) => s.family === family && s.presentation === presentation);
  return step?.generation ?? { range: FAMILIES[family].defaultRange, tempo: 'normal' };
}

/** Nombre de distractrices pour `focusQuestions` questions sur les compétences dues. */
export function distractorCount(focusQuestions: number): number {
  const share = REVIEW.distractorShare;
  return Math.round((focusQuestions * share) / (1 - share));
}

/**
 * Plan d'une séance de révision (§8.4) :
 * 1. les compétences dues, fragiles d'abord puis les plus menacées, 8 au plus ;
 * 2. regroupées par contexte de réponse ;
 * 3. 3 questions chacune, mêlées à ≈ 30 % de distractrices sur les autres compétences
 *    acquises du contexte (les plus confondues un peu plus souvent) ;
 * 4. réponses proposées : toutes les compétences acquises du contexte.
 */
export function planReview(
  reviews: ReadonlyMap<string, ReviewState>,
  at: number,
  random: Random,
  options: { maxDue?: number; boost?: (context: string) => ReadonlyMap<string, number> } = {},
): ReviewPlan {
  const { maxDue = REVIEW.maxDue, boost } = options;
  const due = dueReviews(reviews, at).filter((s) => parseCompetence(s.competenceId));
  const selected = due.slice(0, maxDue);

  // Compétences acquises, par contexte : famille et présentation.
  const acquired = new Map<string, string[]>();
  for (const id of reviews.keys()) {
    const parsed = parseCompetence(id);
    if (!parsed) continue;
    const context = `${parsed.family}:${parsed.presentation}`;
    acquired.set(context, [...(acquired.get(context) ?? []), parsed.item]);
  }

  const blocks: QuestionBlock[] = [];
  for (const family of FAMILY_IDS) {
    for (const presentation of FAMILIES[family].presentations) {
      const context = `${family}:${presentation}`;
      const items = acquired.get(context) ?? [];
      const focus = selected
        .map((s) => parseCompetence(s.competenceId))
        .filter((parsed) => parsed && `${parsed.family}:${parsed.presentation}` === context)
        .map((parsed) => parsed!.item);
      if (focus.length === 0) continue;
      const counts = new Map<string, number>();
      for (const item of focus) counts.set(item, ANSWERS_PER_REVIEW);

      const others = items.filter((item) => !focus.includes(item));
      if (others.length > 0) {
        const extra = boost?.(context);
        // Distractrices réparties équitablement, puis une de plus par confusion active.
        const distractors = new Map<string, number>();
        const total = distractorCount(focus.length * ANSWERS_PER_REVIEW);
        const answerOf = FAMILIES[family].answerOf;
        const boosted = others.filter((item) => (extra?.get(answerOf(item)) ?? 0) > 0);
        const bonus = Math.min(boosted.length, Math.ceil(total / 2));
        spread(distractors, boosted.slice(0, bonus), bonus, random);
        spread(distractors, others, total - bonus, random);
        for (const [item, count] of distractors) counts.set(item, count);
      }
      blocks.push({
        kind: 'review',
        context,
        family,
        presentation,
        choices: answersFor(family, items),
        focus: sortItems(family, focus),
        plan: arrange(counts, random, 2),
        generation: generationOf(family, presentation),
      });
    }
  }
  return {
    blocks,
    dueIds: selected.map((s) => s.competenceId),
    postponed: due.length - selected.length,
  };
}

/** Éléments dans l'ordre des boutons de leurs réponses. */
function sortItems(family: FamilyId, items: readonly string[]): string[] {
  const def = FAMILIES[family];
  const rank = (item: string) => def.answerOrder.indexOf(def.answerOf(item));
  return [...items].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Plan d'un duel (§8.6) : 10 questions, 5 sur chaque élément. Seulement pour les
 * familles où l'élément joué est la réponse (intervalles, accords).
 */
export function planDuel(duel: Duel, random: Random): QuestionBlock {
  const [family, presentation] = duel.context.split(':') as [FamilyId, Presentation];
  if (family === 'inv' || !FAMILIES[family]) {
    throw new Error(`Duel non pris en charge : ${duel.context}`);
  }
  const pair = sortAnswers(family, duel.pair);
  const counts = new Map<string, number>();
  spread(counts, pair, DUEL_LENGTH, random);
  return {
    kind: 'duel',
    context: duel.context,
    family,
    presentation,
    choices: pair,
    focus: pair,
    plan: arrange(counts, random),
    generation: generationOf(family, presentation),
  };
}

/** Question d'un bloc planifié. */
export function blockQuestion(
  block: QuestionBlock,
  item: string,
  random: Random,
  previousAnchor: number | null,
): Question {
  return createQuestion(block.family, {
    item,
    presentation: block.presentation,
    choices: block.choices,
    range: block.generation.range,
    tempo: block.generation.tempo,
    previousAnchor,
    random,
  });
}
