// Note automatique d'une révision (docs/DESIGN.md §8.2 et §8.3).

/** Note FSRS : 1 À revoir, 2 Difficile, 3 Bien, 4 Facile. */
export type Grade = 1 | 2 | 3 | 4;

export const GRADE_LABELS: Readonly<Record<Grade, string>> = {
  1: 'À revoir',
  2: 'Difficile',
  3: 'Bien',
  4: 'Facile',
};

/** Une réponse, vue par la notation. */
export interface AnswerSample {
  correct: boolean;
  responseTimeMs: number;
  replays: number;
  helpUsed: boolean;
}

/** Questions posées par compétence due lors d'une révision. */
export const ANSWERS_PER_REVIEW = 3;

/** Temps de référence tant qu'il n'y a pas assez de réponses pour un temps personnel. */
export const DEFAULT_REFERENCE_MS = 3000;
const MIN_REFERENCE_SAMPLES = 5;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/** Temps de référence : médiane personnelle des bonnes réponses, ou 3 s au départ. */
export function referenceTimeMs(correctTimesMs: readonly number[]): number {
  return correctTimesMs.length < MIN_REFERENCE_SAMPLES
    ? DEFAULT_REFERENCE_MS
    : Math.max(500, median(correctTimesMs));
}

/**
 * Note des réponses d'une révision (§8.3) :
 * - 0 ou 1 bonne réponse sur 3 → À revoir ; 2 → Difficile ;
 * - 3 bonnes mais lentes (médiane > 1,5 × référence) ou avec aides → Difficile ;
 * - 3 bonnes, rapides (médiane < 0,6 × référence) et sans aide → Facile ;
 * - sinon → Bien.
 * Une aide, c'est plus d'une réécoute ou « écouter arpégé ».
 */
export function autoGrade(samples: readonly AnswerSample[], referenceMs: number): Grade {
  if (samples.length === 0) throw new Error('Aucune réponse à noter');
  const correct = samples.filter((sample) => sample.correct).length;
  const ratio = correct / samples.length;
  if (ratio < 0.6) return 1;
  if (ratio < 1) return 2;
  const aided = samples.some((sample) => sample.replays > 1 || sample.helpUsed);
  const time = median(samples.map((sample) => sample.responseTimeMs));
  if (aided || time > 1.5 * referenceMs) return 2;
  if (time < 0.6 * referenceMs) return 4;
  return 3;
}

/** Première note à la validation d'une étape (§8.2) : Bien dès 90 % au test, Difficile sinon. */
export function entryGrade(testAccuracy: number): Grade {
  return testAccuracy >= 0.9 ? 3 : 2;
}
