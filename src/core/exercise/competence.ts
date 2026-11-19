import { INTERVAL_CODES, type IntervalCode } from '../theory';
import type { IntervalPresentation } from './rendition';

/**
 * Identifiant d'une compétence (un élément dans une présentation, §7.1) :
 * `int:m3:asc`, et plus tard `chd:m7b5:block`, `scl:harmin:updown`…
 */
export type CompetenceId = string;

const INTERVAL_PRESENTATIONS: readonly IntervalPresentation[] = ['asc', 'desc', 'harm'];

export function intervalCompetenceId(
  item: IntervalCode,
  presentation: IntervalPresentation,
): CompetenceId {
  return `int:${item}:${presentation}`;
}

export function parseIntervalCompetence(
  id: CompetenceId,
): { item: IntervalCode; presentation: IntervalPresentation } | null {
  const [family, item, presentation, ...rest] = id.split(':');
  if (family !== 'int' || rest.length > 0) return null;
  if (!INTERVAL_CODES.includes(item as IntervalCode)) return null;
  if (!INTERVAL_PRESENTATIONS.includes(presentation as IntervalPresentation)) return null;
  return { item: item as IntervalCode, presentation: presentation as IntervalPresentation };
}
