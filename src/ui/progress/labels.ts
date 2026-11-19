import { getTrack, type StepDef, type StepPhase } from '../../core/curriculum';
import type { StepStatus } from '../../core/progress/projection';
import { INTERVALS } from '../../core/theory';
import { intervalName, presentationTitle } from '../format';

export const PHASE_LABELS: Record<StepPhase, string> = {
  discover: 'Découverte',
  contrast: 'Comparaison',
  train: 'Entraînement',
  test: 'Test',
};

export const STATUS_LABELS: Record<StepStatus, string> = {
  locked: 'verrouillée',
  available: 'à faire',
  in_progress: 'en cours',
  validated: 'validée',
};

/** « 3M, 5J, 8J » ou « + 4J ». */
export function columnLabel(step: StepDef): string {
  const items = step.newItems.map((item) => INTERVALS[item].abbreviation);
  return step.column === 1 ? items.join(', ') : `+ ${items.join(', ')}`;
}

/** « Quarte juste » ou « Tierce majeure, quinte juste et octave ». */
export function newItemsLabel(step: StepDef): string {
  const names = step.newItems.map((item, i) =>
    i === 0 ? intervalName(item) : intervalName(item).toLowerCase(),
  );
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`;
}

/** « Intervalles ascendants · étape 4 ». */
export function stepTitle(step: StepDef): string {
  const track = getTrack(step.track);
  const title = track.id === 'intervals' ? presentationTitle(step.presentation) : track.name;
  return `${title} · étape ${step.column}`;
}
