import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { getTrack, STEPS } from '../curriculum';
import { createRandom } from '../random';
import { PLACEMENT, placementTiers, tierColumns, tierPassed, tierPlan } from './placement';

const none = () => false;

describe('paliers du test de positionnement', () => {
  it('teste les colonnes 1, 4, 7 et 10 des intervalles, ligne par ligne', () => {
    expect(tierColumns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([1, 4, 7, 10]);
    expect(tierColumns([1, 2, 3, 4, 5])).toEqual([1, 4, 5]);
    expect(tierColumns([1, 2, 3])).toEqual([1, 3]);
    const tiers = placementTiers(getTrack('intervals'), STEPS, none);
    expect(tiers.map((t) => t.step.id)).toEqual([
      'int.asc.01',
      'int.asc.04',
      'int.asc.07',
      'int.asc.10',
      'int.desc.01',
      'int.desc.04',
      'int.desc.07',
      'int.desc.10',
      'int.harm.01',
      'int.harm.04',
      'int.harm.07',
      'int.harm.10',
    ]);
    expect(tiers[1]?.steps.map((s) => s.id)).toEqual(['int.asc.02', 'int.asc.03', 'int.asc.04']);
    expect(tiers[1]?.focus).toEqual(['P4', 'm3', 'M2']);
  });

  it('saute les paliers déjà validés', () => {
    const validated = new Set(['int.asc.01', 'int.asc.02', 'int.asc.03', 'int.asc.04']);
    const tiers = placementTiers(getTrack('intervals'), STEPS, (id) => validated.has(id));
    expect(tiers[0]?.step.id).toBe('int.asc.07');
  });

  it('s’arrête avant une étape qui attend un autre parcours', () => {
    expect(placementTiers(getTrack('sevenths'), STEPS, none)).toEqual([]);
    const triadsDone = (id: string) => id.startsWith('tri.');
    const inversions = placementTiers(getTrack('inversions'), STEPS, triadsDone);
    // R1 à R4 seulement : R5 attend les septièmes.
    expect(inversions.map((t) => t.step.id)).toEqual(['inv.block.01', 'inv.block.04']);
    expect(inversions[1]?.focus).toEqual(['maj.2', 'min.0', 'min.1', 'min.2']);
  });

  it('pose 6 questions par palier, surtout sur les éléments récents', () => {
    const tiers = placementTiers(getTrack('intervals'), STEPS, none);
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        for (const tier of tiers) {
          const plan = tierPlan(tier, createRandom(seed));
          expect(plan).toHaveLength(PLACEMENT.questionsPerTier);
          for (const item of plan) expect(tier.step.items).toContain(item);
          const focus = plan.filter((item) => tier.focus.includes(item)).length;
          expect(focus).toBeGreaterThanOrEqual(PLACEMENT.focusQuestions);
        }
      }),
      { numRuns: 20 },
    );
    expect(tierPassed(5)).toBe(true);
    expect(tierPassed(4)).toBe(false);
  });
});
