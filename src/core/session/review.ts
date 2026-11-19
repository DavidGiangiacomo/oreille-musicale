// Séance de révision et duels (docs/DESIGN.md §8.4 et §8.6) : quelles questions
// poser, dans quel ordre. Les notes se déduisent ensuite du journal (core/srs).
import { STEPS } from '../curriculum';
import { parseIntervalCompetence } from '../exercise/competence';
import {
  createIntervalQuestion,
  DEFAULT_INTERVAL_RANGE,
  sortIntervals,
  type IntervalQuestion,
} from '../exercise/intervalQuestion';
import type { IntervalPresentation, Tempo } from '../exercise/rendition';
import { DUEL_LENGTH, type Duel } from '../progress/confusion';
import type { Random } from '../random';
import { ANSWERS_PER_REVIEW, contextOf, dueReviews, type ReviewState } from '../srs';
import type { IntervalCode } from '../theory';
import { arrange, spread } from './plan';

export const REVIEW = {
  /** Compétences dues révisées par séance au plus (§8.4). */
  maxDue: 8,
  /** Part des questions « distractrices » dans un bloc. */
  distractorShare: 0.3,
} as const;

const PRESENTATION_ORDER: readonly IntervalPresentation[] = ['asc', 'desc', 'harm'];

/** Une suite de questions aux réponses homogènes : même famille, même présentation. */
export interface QuestionBlock {
  kind: 'review' | 'duel';
  /** « int:asc ». */
  context: string;
  presentation: IntervalPresentation;
  /** Réponses proposées, dans l'ordre des boutons. */
  choices: IntervalCode[];
  /** Éléments à réviser (révision) ou les deux du duel. */
  focus: IntervalCode[];
  /** Questions, dans l'ordre. */
  plan: IntervalCode[];
  generation: { range: readonly [number, number]; tempo: Tempo };
}

export interface ReviewPlan {
  blocks: QuestionBlock[];
  /** Compétences dues dans cette séance. */
  dueIds: string[];
  /** Compétences dues reportées à une prochaine séance (retard étalé). */
  postponed: number;
}

function generationOf(presentation: IntervalPresentation): QuestionBlock['generation'] {
  const step = STEPS.find((s) => s.track === 'intervals' && s.presentation === presentation);
  return step?.generation ?? { range: DEFAULT_INTERVAL_RANGE, tempo: 'normal' };
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
  const due = dueReviews(reviews, at).filter((s) => parseIntervalCompetence(s.competenceId));
  const selected = due.slice(0, maxDue);

  const acquired = new Map<IntervalPresentation, IntervalCode[]>();
  for (const id of reviews.keys()) {
    const parsed = parseIntervalCompetence(id);
    if (!parsed) continue;
    acquired.set(parsed.presentation, [...(acquired.get(parsed.presentation) ?? []), parsed.item]);
  }

  const blocks: QuestionBlock[] = [];
  for (const presentation of PRESENTATION_ORDER) {
    const focus = selected
      .map((s) => parseIntervalCompetence(s.competenceId))
      .filter((parsed) => parsed?.presentation === presentation)
      .map((parsed) => parsed!.item);
    if (focus.length === 0) continue;
    const choices = sortIntervals(acquired.get(presentation) ?? []);
    const context = contextOf(`int:${focus[0]}:${presentation}`);
    const counts = new Map<IntervalCode, number>();
    for (const item of focus) counts.set(item, ANSWERS_PER_REVIEW);

    const others = choices.filter((item) => !focus.includes(item));
    if (others.length > 0) {
      const extra = boost?.(context);
      // Distractrices réparties équitablement, puis une de plus par confusion active.
      const distractors = new Map<IntervalCode, number>();
      const total = distractorCount(focus.length * ANSWERS_PER_REVIEW);
      const boosted = others.filter((item) => (extra?.get(item) ?? 0) > 0);
      const bonus = Math.min(boosted.length, Math.ceil(total / 2));
      spread(distractors, boosted.slice(0, bonus), bonus, random);
      spread(distractors, others, total - bonus, random);
      for (const [item, count] of distractors) counts.set(item, count);
    }
    blocks.push({
      kind: 'review',
      context,
      presentation,
      choices,
      focus: sortIntervals(focus),
      plan: arrange(counts, random, 2),
      generation: generationOf(presentation),
    });
  }
  return {
    blocks,
    dueIds: selected.map((s) => s.competenceId),
    postponed: due.length - selected.length,
  };
}

/** Plan d'un duel (§8.6) : 10 questions, 5 sur chaque élément. */
export function planDuel(duel: Duel, random: Random): QuestionBlock {
  const [family, presentation] = duel.context.split(':') as [string, IntervalPresentation];
  if (family !== 'int') throw new Error(`Duel non pris en charge : ${duel.context}`);
  const pair = sortIntervals(duel.pair as IntervalCode[]);
  const counts = new Map<IntervalCode, number>();
  spread(counts, pair, DUEL_LENGTH, random);
  return {
    kind: 'duel',
    context: duel.context,
    presentation,
    choices: pair,
    focus: pair,
    plan: arrange(counts, random),
    generation: generationOf(presentation),
  };
}

/** Question d'un bloc planifié. */
export function blockQuestion(
  block: QuestionBlock,
  item: IntervalCode,
  random: Random,
  previousFirstMidi: number | null,
): IntervalQuestion {
  return createIntervalQuestion({
    item,
    presentation: block.presentation,
    choices: block.choices,
    range: block.generation.range,
    tempo: block.generation.tempo,
    previousFirstMidi,
    random,
  });
}
