// Tests de positionnement (docs/DESIGN.md §7.6) : valider d'emblée les étapes déjà
// maîtrisées. Le test avance par paliers, ligne par ligne (pour les intervalles :
// colonnes 1, 4, 7 et 10), 6 questions par palier, et s'arrête au premier palier
// sous 5/6. Les étapes jusqu'au dernier palier réussi sont validées.
import type { StepDef, TrackDef } from '../curriculum';
import type { Random } from '../random';
import { arrange, spread } from './plan';

export const PLACEMENT = {
  questionsPerTier: 6,
  /** Bonnes réponses nécessaires sur un palier. */
  passMin: 5,
  /** Écart entre deux colonnes testées ; la dernière colonne l'est toujours. */
  columnStep: 3,
  /** Questions sur les éléments apparus depuis le palier précédent. */
  focusQuestions: 4,
} as const;

export interface PlacementTier {
  /** Étape testée : la dernière colonne du palier, sur sa ligne. */
  step: StepDef;
  /** Étapes validées si le palier est réussi (celles de la ligne depuis le palier précédent). */
  steps: StepDef[];
  /** Éléments apparus depuis le palier précédent, sur lesquels portent la plupart des questions. */
  focus: string[];
}

/** Colonnes testées d'une ligne : 1, 4, 7… et toujours la dernière. */
export function tierColumns(columns: readonly number[]): number[] {
  const sorted = [...columns].sort((a, b) => a - b);
  const last = sorted.at(-1);
  if (last === undefined) return [];
  const tiers = sorted.filter((column) => (column - 1) % PLACEMENT.columnStep === 0);
  return tiers.includes(last) ? tiers : [...tiers, last];
}

/**
 * Paliers du test d'un parcours, dans l'ordre. Les paliers déjà validés sont sautés ;
 * le test s'arrête avant une étape qui attend un autre parcours non validé
 * (Renversements R5 et Septièmes, par exemple).
 */
export function placementTiers(
  track: TrackDef,
  steps: readonly StepDef[],
  isValidated: (stepId: string) => boolean,
): PlacementTier[] {
  const own = steps.filter((step) => step.track === track.id);
  const ids = new Set(own.map((step) => step.id));
  const tiers: PlacementTier[] = [];
  for (let row = 0; row < track.rows.length; row++) {
    const rowSteps = own.filter((step) => step.row === row).sort((a, b) => a.column - b.column);
    let previous = 0;
    for (const column of tierColumns(rowSteps.map((step) => step.column))) {
      const covered = rowSteps.filter((step) => step.column > previous && step.column <= column);
      previous = column;
      const blocked = covered.some((step) =>
        step.requires.some((id) => !ids.has(id) && !isValidated(id)),
      );
      if (blocked) return tiers;
      if (covered.every((step) => isValidated(step.id))) continue;
      const step = covered.at(-1) as StepDef;
      const fresh = [...new Set(covered.flatMap((s) => s.newItems))];
      tiers.push({ step, steps: covered, focus: fresh.length > 0 ? fresh : [...step.items] });
    }
  }
  return tiers;
}

/** Questions d'un palier : surtout sur les éléments récents, le reste sur les autres. */
export function tierPlan(tier: PlacementTier, random: Random): string[] {
  const others = tier.step.items.filter((item) => !tier.focus.includes(item));
  const focusCount = others.length === 0 ? PLACEMENT.questionsPerTier : PLACEMENT.focusQuestions;
  const counts = new Map<string, number>();
  spread(counts, tier.focus, focusCount, random);
  spread(counts, others, PLACEMENT.questionsPerTier - focusCount, random);
  return arrange(counts, random, 2);
}

export function tierPassed(correct: number): boolean {
  return correct >= PLACEMENT.passMin;
}
