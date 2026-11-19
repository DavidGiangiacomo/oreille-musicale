// Déroulé d'une étape (docs/DESIGN.md §7.3 et §7.5) : découverte, comparaison,
// entraînement, validation. Fonctions pures ; l'interface enchaîne les phases.
import { contrastItems, type StepDef, type StepPhase } from '../curriculum';
import {
  createIntervalQuestion,
  intervalSoundFrom,
  type IntervalQuestion,
  type IntervalSound,
} from '../exercise/intervalQuestion';
import type { Tempo } from '../exercise/rendition';
import { selectWithFocus, type AskedItem } from '../exercise/selection';
import { pick, randomInt, weightedPick, type Random } from '../random';
import { INTERVALS, type IntervalCode } from '../theory';

/** Une réponse donnée pendant une étape. */
export interface StepResult {
  item: IntervalCode;
  correct: boolean;
}

/** Part des questions consacrée aux nouveaux éléments, selon la phase. */
export const FOCUS_SHARE = { contrast: 0.5, train: 0.4, test: 0.3 } as const;

/** Phases dans l'ordre ; la comparaison n'existe que si l'étape a des voisins. */
export function phasesOf(step: StepDef): StepPhase[] {
  return contrastItems(step).length > 0
    ? ['discover', 'contrast', 'train', 'test']
    : ['discover', 'train', 'test'];
}

/** Phase qui suit la découverte ou la comparaison. */
export function phaseAfter(step: StepDef, phase: StepPhase): StepPhase {
  const phases = phasesOf(step);
  return phases[phases.indexOf(phase) + 1] ?? 'test';
}

/** Réponses proposées : le nouvel élément et ses voisins en comparaison, tout l'ensemble sinon. */
export function choicesFor(step: StepDef, phase: StepPhase): IntervalCode[] {
  if (phase !== 'contrast') return [...step.answers];
  const allowed = new Set([...step.newItems, ...contrastItems(step)]);
  return step.answers.filter((item) => allowed.has(item));
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
  newItemCounts: Partial<Record<IntervalCode, number>>;
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
  ) as Partial<Record<IntervalCode, number>>;
  const ready =
    recentAccuracy !== null &&
    recentAccuracy >= READINESS.minAccuracy &&
    step.newItems.every((item) => (newItemCounts[item] ?? 0) >= READINESS.minNewItemCount);
  return { recentAccuracy, newItemCounts, ready };
}

export type Difficulty = 'easier' | 'normal' | 'harder';

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

/** Registre et tempo selon la difficulté : resserré et lent, ou élargi (C3–C6) et rapide. */
export function generationFor(
  step: StepDef,
  difficulty: Difficulty,
): { range: readonly [number, number]; tempo: Tempo } {
  if (difficulty === 'easier') return { range: [55, 74], tempo: 'slow' };
  if (difficulty === 'harder') return { range: [48, 84], tempo: 'fast' };
  return step.generation;
}

/** Longueur du test : 4 questions par réponse possible, entre 12 et 30. */
export function testLength(step: StepDef): number {
  return Math.min(30, Math.max(12, 4 * step.answers.length));
}

/** Répartit `count` questions aussi équitablement que possible entre `items`. */
function spread(
  counts: Map<IntervalCode, number>,
  items: readonly IntervalCode[],
  count: number,
  random: Random,
) {
  if (items.length === 0) return;
  const offset = randomInt(random, 0, items.length - 1);
  for (let i = 0; i < count; i++) {
    const item = items[(i + offset) % items.length] as IntervalCode;
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
}

/** Plus longue suite du même élément dans une liste. */
export function longestRun<T>(items: readonly T[]): number {
  let longest = 0;
  let current = 0;
  items.forEach((item, i) => {
    current = i > 0 && item === items[i - 1] ? current + 1 : 1;
    longest = Math.max(longest, current);
  });
  return longest;
}

/**
 * Ordonne les questions au hasard, sans jamais plus de 3 fois le même élément
 * d'affilée : chaque question est tirée parmi celles qui restent, en écartant
 * l'élément qui vient de sortir 3 fois. S'il reste à la fin un élément bloqué,
 * il est inséré là où il ne crée pas de suite de 4.
 */
function arrange(counts: Map<IntervalCode, number>, random: Random): IntervalCode[] {
  const plan: IntervalCode[] = [];
  for (;;) {
    const last = plan.slice(-3);
    const blocked = last.length === 3 && last.every((item) => item === last[0]) ? last[0] : null;
    const candidates = [...counts].filter(([item, count]) => count > 0 && item !== blocked);
    if (candidates.length === 0) break;
    const item = weightedPick(
      random,
      candidates.map(([candidate]) => candidate),
      candidates.map(([, count]) => count),
    );
    plan.push(item);
    counts.set(item, (counts.get(item) ?? 0) - 1);
  }
  for (const [item, count] of counts) {
    for (let k = 0; k < count; k++) {
      const positions = Array.from({ length: plan.length + 1 }, (_, p) => p).filter(
        (p) => longestRun([...plan.slice(0, p), item, ...plan.slice(p)]) <= 3,
      );
      const position = positions.length > 0 ? pick(random, positions) : plan.length;
      plan.splice(position, 0, item);
    }
  }
  return plan;
}

/** Questions du test, dans l'ordre : ≈ 30 % sur les nouveaux éléments, le reste réparti entre les autres. */
export function createTestPlan(step: StepDef, random: Random): IntervalCode[] {
  const length = testLength(step);
  const others = step.answers.filter((item) => !step.newItems.includes(item));
  const focusCount = others.length === 0 ? length : Math.round(length * FOCUS_SHARE.test);
  const counts = new Map<IntervalCode, number>();
  spread(counts, step.newItems, focusCount, random);
  spread(counts, others, length - focusCount, random);
  return arrange(counts, random);
}

export interface TestEvaluation {
  accuracy: number;
  /** Réussite par nouvel élément. */
  newItemAccuracy: Partial<Record<IntervalCode, number>>;
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
  ) as Partial<Record<IntervalCode, number>>;
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
  /** Réponses déjà données dans cette étape (toutes phases), de la plus ancienne à la plus récente. */
  history: readonly AskedItem<IntervalCode>[];
  /** Réponses de la phase en cours, pour l'ajustement de difficulté. */
  phaseResults: readonly StepResult[];
  random: Random;
  previousFirstMidi: number | null;
  /** En test : l'élément prévu par le plan. */
  plannedItem?: IntervalCode;
}

/** Question suivante d'une étape, selon la phase. */
export function nextStepQuestion(options: StepQuestionOptions): IntervalQuestion {
  const { step, phase, history, phaseResults, random, previousFirstMidi, plannedItem } = options;
  const choices = choicesFor(step, phase);
  const item =
    phase === 'test'
      ? plannedItem
      : selectWithFocus(choices, step.newItems, FOCUS_SHARE[phase], history, random);
  if (!item) throw new Error('Test : élément prévu manquant');
  const { range, tempo } =
    phase === 'train' ? generationFor(step, trainingDifficulty(phaseResults)) : step.generation;
  return createIntervalQuestion({
    item,
    presentation: step.presentation,
    choices,
    range,
    tempo,
    previousFirstMidi,
    random,
  });
}

/** Découverte : l'élément joué sur `count` notes de départ différentes. */
export function discoveryExamples(
  step: StepDef,
  item: IntervalCode,
  random: Random,
  count = 4,
): IntervalSound[] {
  const sounds: IntervalSound[] = [];
  let previous: number | null = null;
  for (let i = 0; i < count; i++) {
    const question = createIntervalQuestion({
      item,
      presentation: step.presentation,
      choices: [item],
      range: step.generation.range,
      previousFirstMidi: previous,
      random,
    });
    previous = question.midi[0];
    sounds.push(question);
  }
  return sounds;
}

/**
 * Découverte : plusieurs éléments joués l'un après l'autre depuis la même note
 * de départ (le nouvel élément et son voisin, ou les trois premiers repères),
 * deux fois sur deux notes de départ différentes.
 */
export function comparisonExamples(
  step: StepDef,
  items: readonly IntervalCode[],
  random: Random,
): IntervalSound[] {
  const sounds: IntervalSound[] = [];
  const widest = items.reduce((a, b) => (INTERVALS[a].semitones >= INTERVALS[b].semitones ? a : b));
  let previous: number | null = null;
  for (let round = 0; round < 2; round++) {
    // La note de départ est choisie pour que l'intervalle le plus grand tienne dans le registre.
    const anchor = createIntervalQuestion({
      item: widest,
      presentation: step.presentation,
      choices: [widest],
      range: step.generation.range,
      previousFirstMidi: previous,
      random,
    });
    previous = anchor.midi[0];
    for (const item of items) {
      sounds.push(intervalSoundFrom(anchor.notes[0], item, step.presentation));
    }
  }
  return sounds;
}
