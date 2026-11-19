import { answersFor, FAMILIES } from '../exercise/families';
import { midiOf } from '../theory';
import { INVERSIONS_TRACK, SEVENTHS_TRACK, TRIADS_TRACK } from './chords';
import { INTERVALS_TRACK } from './intervals';
import { MODES_TRACK, SCALES_TRACK } from './scales';
import type { StepDef, TrackDef, TrackId } from './types';

export type { StepDef, StepPhase, TrackColumn, TrackDef, TrackId, TrackRow } from './types';
export { INTERVALS_TRACK } from './intervals';
export { INVERSIONS_TRACK, SEVENTHS_TRACK, TRIADS_TRACK } from './chords';
export { MODES_TRACK, SCALES_TRACK } from './scales';
export { INTERVAL_LANDMARKS, landmarkFor, landmarkKey, type LandmarkDirection } from './landmarks';

/**
 * Version du curriculum, enregistrée avec chaque séance. À incrémenter dès qu'une
 * étape change (réponses, ordre, seuils) : le journal garde ainsi le contexte.
 * 2 : parcours Triades, Septièmes et Renversements. 3 : Gammes et Modes.
 */
export const CURRICULUM_VERSION = '3';

/** Seuils de validation d'une étape (§7.3). */
export const VALIDATION = { minAccuracy: 0.9, minNewItemAccuracy: 0.75 } as const;

export const TRACKS: readonly TrackDef[] = [
  INTERVALS_TRACK,
  TRIADS_TRACK,
  SEVENTHS_TRACK,
  INVERSIONS_TRACK,
  SCALES_TRACK,
  MODES_TRACK,
];

export function stepId(track: TrackDef, row: number, column: number): string {
  const presentation = track.rows[row]?.presentation;
  if (!presentation || column < 1 || column > track.columns.length) {
    throw new Error(`Étape hors de la grille : ligne ${row}, colonne ${column}`);
  }
  return `${track.prefix}.${presentation}.${String(column).padStart(2, '0')}`;
}

/** Une colonne existe-t-elle dans une ligne ? (Les suspendus n'ont pas de ligne renversée.) */
function exists(track: TrackDef, row: number, column: number): boolean {
  const presentation = track.rows[row]?.presentation;
  const columnDef = track.columns[column - 1];
  if (!presentation || !columnDef) return false;
  return !columnDef.rows || columnDef.rows.includes(presentation);
}

/** Éléments dans l'ordre des réponses (puis dans leur ordre d'origine). */
function sortItems(track: TrackDef, items: readonly string[]): string[] {
  const family = FAMILIES[track.family];
  const rank = (item: string) => family.answerOrder.indexOf(family.answerOf(item));
  return [...new Set(items)].sort((a, b) => rank(a) - rank(b));
}

/** Étapes d'un parcours, ligne par ligne, de gauche à droite. */
export function buildSteps(track: TrackDef): StepDef[] {
  const range: [number, number] = [midiOf(track.range[0]), midiOf(track.range[1])];
  const steps: StepDef[] = [];
  track.rows.forEach(({ presentation }, row) => {
    const accumulated: string[] = [];
    track.columns.forEach((columnDef, index) => {
      const column = index + 1;
      if (!exists(track, row, column)) return;
      accumulated.push(...(columnDef.add ?? []));
      const items = sortItems(track, columnDef.items ?? accumulated);
      const newItems = columnDef.items
        ? [...(columnDef.newItems ?? [])]
        : [...(columnDef.add ?? [])];
      const requires: string[] = [];
      if (column > 1) requires.push(stepId(track, row, column - 1));
      if (row > 0 && exists(track, row - 1, column)) requires.push(stepId(track, row - 1, column));
      if (row === 0 && column === 1) requires.push(...(track.unlockedBy ?? []));
      requires.push(...(columnDef.requires ?? []));
      steps.push({
        id: stepId(track, row, column),
        track: track.id,
        family: track.family,
        row,
        column,
        presentation,
        items,
        answers: answersFor(track.family, items),
        newItems,
        contrast: { ...columnDef.contrast },
        generation: { range, tempo: 'normal' },
        validation: { ...VALIDATION },
        requires,
      });
    });
  });
  return steps;
}

export const STEPS: readonly StepDef[] = TRACKS.flatMap(buildSteps);

const STEPS_BY_ID = new Map(STEPS.map((step) => [step.id, step]));

export function getStep(id: string): StepDef | undefined {
  return STEPS_BY_ID.get(id);
}

export function getTrack(id: TrackId): TrackDef {
  const track = TRACKS.find((candidate) => candidate.id === id);
  if (!track) throw new Error(`Parcours inconnu : ${id}`);
  return track;
}

export function stepsOfTrack(id: TrackId): StepDef[] {
  return STEPS.filter((step) => step.track === id);
}

/** Voisins à comparer aux nouveaux éléments d'une étape (sans doublon, dans l'ordre des éléments). */
export function contrastItems(step: StepDef): string[] {
  const neighbors = new Set(step.newItems.flatMap((item) => step.contrast[item] ?? []));
  return step.items.filter((item) => neighbors.has(item) && !step.newItems.includes(item));
}
