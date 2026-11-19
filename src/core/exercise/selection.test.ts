import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { selectNextItem, type AskedItem } from './selection';

/** Simule une série : tire, puis répond juste avec la probabilité donnée par élément. */
function simulate(
  items: string[],
  length: number,
  seed: number,
  accuracy: (item: string) => number,
) {
  const random = createRandom(seed);
  const answers = createRandom(seed + 1);
  const history: AskedItem<string>[] = [];
  for (let i = 0; i < length; i++) {
    const item = selectNextItem(items, history, random);
    history.push({ item, correct: answers.next() < accuracy(item) });
  }
  return history.map((entry) => entry.item);
}

const itemSets = fc
  .integer({ min: 2, max: 12 })
  .map((count) => Array.from({ length: count }, (_, i) => `i${i}`));

describe('selectNextItem', () => {
  it('ne pose jamais plus de 3 fois la même réponse d’affilée', () => {
    fc.assert(
      fc.property(fc.integer(), itemSets, (seed, items) => {
        const sequence = simulate(items, 200, seed, () => 0.5);
        for (let i = 3; i < sequence.length; i++) {
          const run = sequence.slice(i - 3, i + 1);
          expect(run.every((item) => item === run[0])).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('ne laisse aucun élément plus de 3 × (nombre d’éléments) questions sans venir', () => {
    fc.assert(
      fc.property(fc.integer(), itemSets, (seed, items) => {
        // Un élément toujours réussi est le moins favorisé par les poids.
        const sequence = simulate(items, 300, seed, (item) => (item === 'i0' ? 1 : 0));
        for (const item of items) {
          let gap = 0;
          for (const asked of sequence) {
            gap = asked === item ? 0 : gap + 1;
            expect(gap).toBeLessThan(3 * items.length);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('favorise les éléments souvent ratés', () => {
    const items = ['facile', 'difficile', 'moyen'];
    const sequence = simulate(items, 3000, 2024, (item) =>
      item === 'facile' ? 1 : item === 'difficile' ? 0 : 0.5,
    );
    const count = (item: string) => sequence.filter((asked) => asked === item).length;
    expect(count('difficile')).toBeGreaterThan(count('moyen'));
    expect(count('moyen')).toBeGreaterThan(count('facile'));
  });

  it('se contente du seul élément disponible', () => {
    const history = [
      { item: 'a', correct: true },
      { item: 'a', correct: true },
      { item: 'a', correct: true },
    ];
    expect(selectNextItem(['a'], history, createRandom(1))).toBe('a');
    expect(() => selectNextItem([], [], createRandom(1))).toThrow();
  });
});
