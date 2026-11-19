// Composition d'une suite de questions planifiées (test d'étape, révision, duel).
import { pick, randomInt, weightedPick, type Random } from '../random';

/** Répartit `count` questions aussi équitablement que possible entre `items`. */
export function spread<T>(
  counts: Map<T, number>,
  items: readonly T[],
  count: number,
  random: Random,
) {
  if (items.length === 0) return;
  const offset = randomInt(random, 0, items.length - 1);
  for (let i = 0; i < count; i++) {
    const item = items[(i + offset) % items.length] as T;
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
 * Ordonne les questions au hasard, sans plus de `maxRun` fois le même élément
 * d'affilée (3 par défaut, §7.5) : chaque question est tirée parmi celles qui
 * restent, en écartant l'élément qui vient de sortir `maxRun` fois. S'il reste à la
 * fin un élément bloqué, il est inséré là où il ne crée pas de suite trop longue
 * (à la fin si c'est impossible).
 */
export function arrange<T>(counts: Map<T, number>, random: Random, maxRun = 3): T[] {
  const plan: T[] = [];
  for (;;) {
    const last = plan.slice(-maxRun);
    const blocked =
      last.length === maxRun && last.every((item) => item === last[0]) ? last[0] : undefined;
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
        (p) => longestRun([...plan.slice(0, p), item, ...plan.slice(p)]) <= maxRun,
      );
      const position = positions.length > 0 ? pick(random, positions) : plan.length;
      plan.splice(position, 0, item);
    }
  }
  return plan;
}
