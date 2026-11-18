import type { IntervalPresentation, Tempo } from '../../core/exercise/rendition';
import {
  createSeriesConfig,
  DEFAULT_SERIES_LENGTH,
  type SeriesConfig,
} from '../../core/session/series';
import { INTERVAL_CODES, type IntervalCode } from '../../core/theory';

const PRESENTATIONS: readonly IntervalPresentation[] = ['asc', 'desc', 'harm'];

/** Adresse d'une série : `/serie?p=asc&i=M3,P5,P8&n=20`. */
export function seriesPath(
  presentation: IntervalPresentation,
  items: readonly IntervalCode[],
  length: number = DEFAULT_SERIES_LENGTH,
): string {
  const params = new URLSearchParams({ p: presentation, i: items.join(','), n: String(length) });
  return `/serie?${params.toString()}`;
}

/** Configuration d'une série lue dans l'adresse, ou null si elle est invalide. */
export function configFromParams(params: URLSearchParams, tempo: Tempo): SeriesConfig | null {
  const presentation = params.get('p') as IntervalPresentation | null;
  if (!presentation || !PRESENTATIONS.includes(presentation)) return null;
  const items = (params.get('i') ?? '')
    .split(',')
    .filter((code): code is IntervalCode => INTERVAL_CODES.includes(code as IntervalCode));
  if (items.length === 0) return null;
  const length = Number(params.get('n') ?? DEFAULT_SERIES_LENGTH);
  if (!Number.isInteger(length) || length < 1 || length > 100) return null;
  return createSeriesConfig([...new Set(items)], presentation, { length, tempo });
}
