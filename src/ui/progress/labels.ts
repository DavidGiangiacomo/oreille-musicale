import { getTrack, type StepDef, type StepPhase } from '../../core/curriculum';
import type { StepStatus } from '../../core/progress/projection';
import { parseInversionItem } from '../../core/exercise/chordQuestion';
import type { ChordQuality } from '../../core/theory';
import { answerLabel, answersList, chordName, itemName, itemShort } from '../items';

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

/** « Tierce majeure, quinte juste et octave ». */
function listOf(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`;
}

/** Accords d'une étape de renversements, dans l'ordre : « M + m ». */
function inversionQualities(items: readonly string[]): ChordQuality[] {
  const qualities: ChordQuality[] = [];
  for (const item of items) {
    const quality = parseInversionItem(item)?.quality;
    if (quality && !qualities.includes(quality)) qualities.push(quality);
  }
  return qualities;
}

/** Libellé de colonne : « 3M, 5J, 8J », « + 4J », « + ° », « M + m · Fond., 1er, 2e ». */
export function columnLabel(step: StepDef): string {
  if (step.family === 'inv') {
    const qualities = inversionQualities(step.items).map((q) => itemShort('chd', q));
    return `${qualities.join(' + ')} · ${answersList('inv', step.answers)}`;
  }
  const items = step.newItems.map((item) => itemShort(step.family, item));
  return step.column === 1 ? items.join(', ') : `+ ${items.join(', ')}`;
}

/** Ce que l'étape introduit : « Quarte juste », « Accord de quinte diminuée ». */
export function newItemsLabel(step: StepDef): string {
  if (step.family === 'inv') {
    if (step.newItems.length === 0) {
      return `${listOf(inversionQualities(step.items).map(chordName))} mêlés`;
    }
    return inversionQualities(step.newItems)
      .map((quality) => {
        const inversions = step.newItems
          .map(parseInversionItem)
          .filter((parsed) => parsed?.quality === quality)
          .map((parsed) => answerLabel('inv', `inv${parsed!.inversion}`).name.toLowerCase());
        return `${chordName(quality)} : ${listOf(inversions)}`;
      })
      .join(' ; ');
  }
  const names = step.newItems.map((item, i) => {
    const name = itemName(step.family, item);
    return i === 0 ? name : name.toLowerCase();
  });
  return listOf(names);
}

/** « Intervalles ascendants · étape 4 », « Triades plaquées · étape 2 ». */
export function stepTitle(step: StepDef): string {
  const row = getTrack(step.track).rows[step.row];
  return `${row?.title ?? getTrack(step.track).name} · étape ${step.column}`;
}

/** Sous-titre d'une étape : « Nouveau : Quarte juste (4J) », « Premiers repères : … ». */
export function stepSubtitle(step: StepDef): string {
  if (step.family === 'inv') {
    return step.newItems.length === 0
      ? `Révision : ${newItemsLabel(step).toLowerCase()}`
      : `Nouveau : ${newItemsLabel(step)}`;
  }
  const prefix = step.column === 1 ? 'Premiers repères' : 'Nouveau';
  // Gammes et modes : leur nom suffit, l'abréviation de la grille n'apporterait rien.
  if (step.family === 'scl' || step.family === 'mod') return `${prefix} : ${newItemsLabel(step)}`;
  return `${prefix} : ${newItemsLabel(step)} (${columnLabel(step).replace('+ ', '')})`;
}
