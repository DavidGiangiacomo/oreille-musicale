import type { QuestionBlock } from '../../core/session/review';
import { ANSWERS_PER_REVIEW } from '../../core/srs';
import { INTERVALS, type IntervalCode } from '../../core/theory';
import { presentationTitle } from '../format';

/** « demain », « dans 8 jours ». */
export function inDays(days: number): string {
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}

/** « 6M / 7m ». */
export function pairLabel(items: readonly string[]): string {
  return items.map((item) => INTERVALS[item as IntervalCode].abbreviation).join(' / ');
}

/** « Révisions · Intervalles ascendants », « Duel · 6M / 7m ». */
export function blockTitle(block: QuestionBlock): string {
  return block.kind === 'duel'
    ? `Duel · ${pairLabel(block.choices)}`
    : `Révisions · ${presentationTitle(block.presentation)}`;
}

/** Ce que la séance demande, en une phrase. */
export function blockDescription(block: QuestionBlock): string {
  if (block.kind === 'duel') {
    return `Deux réponses seulement, ${block.plan.length} questions. Après chaque réponse, les deux intervalles sont rejoués pour comparer.`;
  }
  const count = block.focus.length;
  const items = block.focus.map((item) => INTERVALS[item].abbreviation).join(', ');
  const mixed = block.plan.length > count * ANSWERS_PER_REVIEW ? ', mêlés à quelques autres' : '';
  return `${count} ${count > 1 ? 'intervalles' : 'intervalle'} à réviser (${items})${mixed} : ${block.plan.length} questions.`;
}

export function minutes(ms: number): number {
  return Math.floor(ms / 60_000);
}
