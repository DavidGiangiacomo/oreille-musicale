import type { QuestionBlock } from '../../core/session/review';
import { ANSWERS_PER_REVIEW } from '../../core/srs';
import { answerLabel, contextTitle, itemShort } from '../items';

/** « demain », « dans 8 jours ». */
export function inDays(days: number): string {
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}

/** « 6M / 7m ». */
export function pairLabel(block: QuestionBlock): string {
  return block.choices.map((answer) => answerLabel(block.family, answer).short).join(' / ');
}

/** « Révisions · Intervalles ascendants », « Duel · 6M / 7m ». */
export function blockTitle(block: QuestionBlock): string {
  return block.kind === 'duel'
    ? `Duel · ${pairLabel(block)}`
    : `Révisions · ${contextTitle(block.family, block.presentation)}`;
}

/** Ce que la séance demande, en une phrase. */
export function blockDescription(block: QuestionBlock): string {
  if (block.kind === 'duel') {
    const what = block.family === 'int' ? 'intervalles' : 'accords';
    return `Deux réponses seulement, ${block.plan.length} questions. Après chaque réponse, les deux ${what} sont rejoués pour comparer.`;
  }
  const count = block.focus.length;
  const items = block.focus.map((item) => itemShort(block.family, item)).join(', ');
  const mixed = block.plan.length > count * ANSWERS_PER_REVIEW ? ', mêlés à quelques autres' : '';
  const noun = { int: 'intervalle', chd: 'accord', inv: 'renversement' }[block.family];
  return `${count} ${noun}${count > 1 ? 's' : ''} à réviser (${items})${mixed} : ${block.plan.length} questions.`;
}

export function minutes(ms: number): number {
  return Math.floor(ms / 60_000);
}
