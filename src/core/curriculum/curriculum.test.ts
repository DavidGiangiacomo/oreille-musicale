import { describe, expect, it } from 'vitest';
import { INTERVAL_CODES } from '../theory';
import {
  buildSteps,
  contrastItems,
  getStep,
  INTERVALS_TRACK,
  STEPS,
  stepId,
  stepsOfTrack,
} from './index';

const steps = stepsOfTrack('intervals');

describe('parcours Intervalles', () => {
  it('compte 30 étapes : 3 présentations × 10 colonnes, ligne par ligne', () => {
    expect(steps).toHaveLength(30);
    expect(steps[0]?.id).toBe('int.asc.01');
    expect(steps[9]?.id).toBe('int.asc.10');
    expect(steps[10]?.id).toBe('int.desc.01');
    expect(steps[29]?.id).toBe('int.harm.10');
    expect(new Set(STEPS.map((step) => step.id)).size).toBe(STEPS.length);
  });

  it('suit l’ordre du document de conception (§7.2)', () => {
    const asc = steps.filter((step) => step.presentation === 'asc');
    expect(asc.map((step) => step.newItems.join('+'))).toEqual([
      'M3+P5+P8',
      'P4',
      'm3',
      'M2',
      'm2',
      'M6',
      'm6',
      'm7',
      'M7',
      'TT',
    ]);
    expect(asc.map((step) => step.answers.length)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(asc.at(-1)?.answers).toEqual([...INTERVAL_CODES]);
    expect(getStep('int.asc.02')?.contrast).toEqual({ P4: ['P5', 'M3'] });
    expect(getStep('int.harm.07')?.contrast).toEqual({ m6: ['M6', 'P5'] });
  });

  it('a des données cohérentes pour chaque étape', () => {
    for (const step of steps) {
      const previous =
        step.column > 1 ? getStep(stepId(INTERVALS_TRACK, step.row, step.column - 1)) : undefined;
      for (const item of step.newItems) {
        expect(step.answers).toContain(item);
        expect(previous?.answers ?? []).not.toContain(item);
      }
      // Les voisins sont des éléments déjà connus, et seuls les nouveaux en ont.
      for (const [item, neighbors] of Object.entries(step.contrast)) {
        expect(step.newItems).toContain(item);
        for (const neighbor of neighbors ?? []) expect(previous?.answers).toContain(neighbor);
      }
      if (step.column > 1) expect(contrastItems(step).length).toBeGreaterThan(0);
      expect(step.answers).toEqual(INTERVAL_CODES.filter((code) => step.answers.includes(code)));
      const [low, high] = step.generation.range;
      expect(high - low).toBeGreaterThanOrEqual(12);
      expect(step.validation).toEqual({ minAccuracy: 0.9, minNewItemAccuracy: 0.75 });
    }
  });

  it('exige l’étape de gauche et celle du dessus', () => {
    expect(getStep('int.asc.01')?.requires).toEqual([]);
    expect(getStep('int.asc.04')?.requires).toEqual(['int.asc.03']);
    expect(getStep('int.desc.01')?.requires).toEqual(['int.asc.01']);
    expect(getStep('int.harm.05')?.requires).toEqual(['int.harm.04', 'int.desc.05']);
    for (const step of STEPS) for (const id of step.requires) expect(getStep(id)).toBeDefined();
  });

  it('refuse une position hors de la grille', () => {
    expect(() => stepId(INTERVALS_TRACK, 3, 1)).toThrow();
    expect(() => stepId(INTERVALS_TRACK, 0, 11)).toThrow();
    expect(buildSteps(INTERVALS_TRACK)).toEqual(steps);
  });

  it('liste les voisins à comparer, sans doublon', () => {
    expect(contrastItems(getStep('int.asc.02')!)).toEqual(['M3', 'P5']);
    expect(contrastItems(getStep('int.asc.01')!)).toEqual([]);
  });
});
