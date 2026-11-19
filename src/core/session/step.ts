// Déroulé d'une étape (docs/DESIGN.md §7.3 et §7.5) : découverte, comparaison,
// entraînement, validation. Fonctions pures ; l'interface enchaîne les phases.
import { contrastItems, type StepDef, type StepPhase } from '../curriculum';
import { answersFor, createQuestion, FAMILIES, type Question } from '../exercise/families';
import type { Difficulty, Generation, Sound } from '../exercise/question';
import { selectWithFocus, type AskedItem } from '../exercise/selection';
import type { Random } from '../random';
import { arrange, spread } from './plan';

export { longestRun } from './plan';
export type { Difficulty } from '../exercise/question';

/** Une réponse donnée pendant une étape : l'élément joué et la réussite. */
export interface StepResult {
  item: string;
  correct: boolean;
}

/** Part des questions consacrée aux nouveaux éléments, selon la phase. */
export const FOCUS_SHARE = { contrast: 0.5, train: 0.4, test: 0.3 } as const;

/**
 * Phases dans l'ordre : la comparaison n'existe que si l'étape a des voisins ; une
 * étape sans nouvel élément (R4) se limite à l'entraînement et au test.
 */
export function phasesOf(step: StepDef): StepPhase[] {
  if (step.newItems.length === 0) return ['train', 'test'];
  return contrastItems(step).length > 0
    ? ['discover', 'contrast', 'train', 'test']
    : ['discover', 'train', 'test'];
}

/** Phase qui suit la découverte ou la comparaison. */
export function phaseAfter(step: StepDef, phase: StepPhase): StepPhase {
  const phases = phasesOf(step);
  return phases[phases.indexOf(phase) + 1] ?? 'test';
}

/** Éléments joués : le nouvel élément et ses voisins en comparaison, tout l'ensemble sinon. */
export function itemsFor(step: StepDef, phase: StepPhase): string[] {
  if (phase !== 'contrast') return [...step.items];
  const allowed = new Set([...step.newItems, ...contrastItems(step)]);
  return step.items.filter((item) => allowed.has(item));
}

/** Réponses proposées pendant une phase, dans l'ordre des boutons. */
export function choicesFor(step: StepDef, phase: StepPhase): string[] {
  return answersFor(step.family, itemsFor(step, phase));
}

/** La comparaison s'arrête après 8 bonnes réponses sur les 10 dernières, ou 20 questions. */
export function contrastComplete(results: readonly StepResult[]): boolean {
  if (results.length >= 20) return true;
  return results.slice(-10).filter((result) => result.correct).length >= 8;
}

export interface TrainingReadiness {
  /** Réussite sur les 20 dernières réponses (null avant 20 réponses). */
  recentAccuracy: number | null;
  /** Passages de chaque nouvel élément depuis le début de l'entraînement. */
  newItemCounts: Partial<Record<string, number>>;
  ready: boolean;
}

export const READINESS = { window: 20, minAccuracy: 0.85, minNewItemCount: 5 } as const;

/** Le test est proposé dès 85 % sur les 20 dernières réponses et 5 passages de chaque nouvel élément. */
export function trainingReadiness(
  step: StepDef,
  results: readonly StepResult[],
): TrainingReadiness {
  const recent = results.slice(-READINESS.window);
  const recentAccuracy =
    recent.length < READINESS.window
      ? null
      : recent.filter((result) => result.correct).length / recent.length;
  const newItemCounts = Object.fromEntries(
    step.newItems.map((item) => [item, results.filter((result) => result.item === item).length]),
  );
  const ready =
    recentAccuracy !== null &&
    recentAccuracy >= READINESS.minAccuracy &&
    step.newItems.every((item) => (newItemCounts[item] ?? 0) >= READINESS.minNewItemCount);
  return { recentAccuracy, newItemCounts, ready };
}

/**
 * Ajustement en entraînement (§7.5), sur les 10 dernières réponses : moins de 65 %,
 * on simplifie ; plus de 90 %, on ajoute de la variabilité.
 */
export function trainingDifficulty(results: readonly StepResult[]): Difficulty {
  const recent = results.slice(-10);
  if (recent.length < 10) return 'normal';
  const accuracy = recent.filter((result) => result.correct).length / recent.length;
  if (accuracy < 0.65) return 'easier';
  if (accuracy > 0.9) return 'harder';
  return 'normal';
}

/** Registre et tempo selon la difficulté : resserré et lent, ou élargi et rapide. */
export function generationFor(step: StepDef, difficulty: Difficulty): Generation {
  return FAMILIES[step.family].generationFor(step.generation, difficulty);
}

/** Longueur du test : 4 questions par élément, entre 12 et 30. */
export function testLength(step: StepDef): number {
  return Math.min(30, Math.max(12, 4 * step.items.length));
}

/**
 * Questions du test, dans l'ordre : ≈ 30 % sur les nouveaux éléments (au moins 2
 * chacun), le reste réparti entre les autres.
 */
export function createTestPlan(step: StepDef, random: Random): string[] {
  const length = testLength(step);
  const others = step.items.filter((item) => !step.newItems.includes(item));
  const focusCount =
    others.length === 0
      ? length
      : Math.min(
          length - others.length,
          Math.max(Math.round(length * FOCUS_SHARE.test), 2 * step.newItems.length),
        );
  const counts = new Map<string, number>();
  spread(counts, step.newItems, focusCount, random);
  spread(counts, others, length - (step.newItems.length > 0 ? focusCount : 0), random);
  return arrange(counts, random);
}

export interface TestEvaluation {
  accuracy: number;
  /** Réussite par nouvel élément. */
  newItemAccuracy: Partial<Record<string, number>>;
  passed: boolean;
}

/** Réussi avec au moins 90 % au total et 75 % sur chaque nouvel élément. */
export function evaluateTest(step: StepDef, results: readonly StepResult[]): TestEvaluation {
  const accuracy =
    results.length === 0 ? 0 : results.filter((result) => result.correct).length / results.length;
  const newItemAccuracy = Object.fromEntries(
    step.newItems.map((item) => {
      const asked = results.filter((result) => result.item === item);
      return [item, asked.length === 0 ? 0 : asked.filter((r) => r.correct).length / asked.length];
    }),
  );
  const passed =
    accuracy >= step.validation.minAccuracy &&
    step.newItems.every(
      (item) => (newItemAccuracy[item] ?? 0) >= step.validation.minNewItemAccuracy,
    );
  return { accuracy, newItemAccuracy, passed };
}

export interface StepQuestionOptions {
  step: StepDef;
  phase: Exclude<StepPhase, 'discover'>;
  /** Éléments déjà joués dans cette étape (toutes phases), du plus ancien au plus récent. */
  history: readonly AskedItem<string>[];
  /** Réponses de la phase en cours, pour l'ajustement de difficulté. */
  phaseResults: readonly StepResult[];
  random: Random;
  /** Note de référence de la question précédente. */
  previousAnchor: number | null;
  /** En test : l'élément prévu par le plan. */
  plannedItem?: string;
  /** Renfort des paires confondues dans les tirages (§8.6), par élément. */
  boost?: ReadonlyMap<string, number>;
}

/** Question suivante d'une étape, selon la phase. */
export function nextStepQuestion(options: StepQuestionOptions): Question {
  const { step, phase, history, phaseResults, random, previousAnchor, plannedItem, boost } =
    options;
  const items = itemsFor(step, phase);
  const item =
    phase === 'test'
      ? plannedItem
      : selectWithFocus(items, step.newItems, FOCUS_SHARE[phase], history, random, { boost });
  if (!item) throw new Error('Test : élément prévu manquant');
  const { range, tempo } =
    phase === 'train' ? generationFor(step, trainingDifficulty(phaseResults)) : step.generation;
  return createQuestion(step.family, {
    item,
    presentation: step.presentation,
    choices: answersFor(step.family, items),
    range,
    tempo,
    previousAnchor,
    random,
  });
}

/** Découverte : l'élément joué sur `count` notes de référence différentes. */
export function discoveryExamples(
  step: StepDef,
  item: string,
  random: Random,
  count = 4,
): Question[] {
  const examples: Question[] = [];
  let previous: number | null = null;
  for (let i = 0; i < count; i++) {
    const question = createQuestion(step.family, {
      item,
      presentation: step.presentation,
      choices: answersFor(step.family, [item]),
      range: step.generation.range,
      previousAnchor: previous,
      random,
    });
    previous = question.anchor;
    examples.push(question);
  }
  return examples;
}

/**
 * Découverte : plusieurs éléments joués l'un après l'autre depuis la même note de
 * référence (le nouvel élément et son voisin, ou les premiers repères), deux fois
 * sur deux notes différentes.
 */
export function comparisonExamples(
  step: StepDef,
  items: readonly string[],
  random: Random,
): Sound[] {
  const family = FAMILIES[step.family];
  const anchorItem = family.comparisonAnchor(items);
  const sounds: Sound[] = [];
  let previous: number | null = null;
  for (let round = 0; round < 2; round++) {
    const anchor = createQuestion(step.family, {
      item: anchorItem,
      presentation: step.presentation,
      choices: answersFor(step.family, [anchorItem]),
      range: step.generation.range,
      previousAnchor: previous,
      random,
    });
    previous = anchor.anchor;
    for (const item of items) sounds.push(family.soundFrom(anchor, item));
  }
  return sounds;
}
