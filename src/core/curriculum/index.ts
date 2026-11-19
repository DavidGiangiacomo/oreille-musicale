import { sortIntervals } from '../exercise/intervalQuestion';
import { midiOf, type IntervalCode } from '../theory';
import { INTERVALS_TRACK } from './intervals';
import type { StepDef, TrackDef, TrackId } from './types';

export type { StepDef, StepPhase, TrackColumn, TrackDef, TrackId } from './types';
export { INTERVALS_TRACK } from './intervals';

/**
 * Version du curriculum, enregistrée avec chaque séance. À incrémenter dès qu'une
 * étape change (réponses, ordre, seuils) : le journal garde ainsi le contexte.
 */
export const CURRICULUM_VERSION = '1';

/** Seuils de validation d'une étape (§7.3). */
export const VALIDATION = { minAccuracy: 0.9, minNewItemAccuracy: 0.75 } as const;

export const TRACKS: readonly TrackDef[] = [INTERVALS_TRACK];

export function stepId(track: TrackDef, row: number, column: number): string {
  const presentation = track.rows[row]?.presentation;
  if (!presentation || column < 1 || column > track.columns.length) {
    throw new Error(`Étape hors de la grille : ligne ${row}, colonne ${column}`);
  }
  return `${track.prefix}.${presentation}.${String(column).padStart(2, '0')}`;
}

/** Étapes d'un parcours, ligne par ligne, de gauche à droite. */
export function buildSteps(track: TrackDef): StepDef[] {
  const range: [number, number] = [midiOf(track.range[0]), midiOf(track.range[1])];
  const steps: StepDef[] = [];
  track.rows.forEach(({ presentation }, row) => {
    const answers: IntervalCode[] = [];
    track.columns.forEach((columnDef, index) => {
      const column = index + 1;
      answers.push(...columnDef.add);
      const requires: string[] = [];
      if (column > 1) requires.push(stepId(track, row, column - 1));
      if (row > 0) requires.push(stepId(track, row - 1, column));
      steps.push({
        id: stepId(track, row, column),
        track: track.id,
        row,
        column,
        presentation,
        answers: sortIntervals(answers),
        newItems: [...columnDef.add],
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

/** Voisins à comparer aux nouveaux éléments d'une étape (sans doublon). */
export function contrastItems(step: StepDef): IntervalCode[] {
  const neighbors = step.newItems.flatMap((item) => step.contrast[item] ?? []);
  return sortIntervals(neighbors.filter((item) => !step.newItems.includes(item)));
}
