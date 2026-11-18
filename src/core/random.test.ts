import { describe, expect, it } from 'vitest';
import { createRandom, pick, randomInt, weightedPick } from './random';

describe('createRandom', () => {
  it('rejoue les mêmes tirages à graine égale', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const c = createRandom(43);
    const draws = (r: { next(): number }) => Array.from({ length: 5 }, () => r.next());
    const first = draws(a);
    expect(draws(b)).toEqual(first);
    expect(draws(c)).not.toEqual(first);
  });

  it('reste dans [0, 1[ et se répartit à peu près uniformément', () => {
    const random = createRandom(7);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10000; i++) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      buckets[Math.floor(value * 10)] += 1;
    }
    for (const count of buckets) expect(count).toBeGreaterThan(900);
  });
});

describe('utilitaires de tirage', () => {
  it('tire des entiers bornes comprises', () => {
    const random = createRandom(1);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(randomInt(random, 3, 5));
    expect([...seen].sort()).toEqual([3, 4, 5]);
    expect(() => randomInt(random, 5, 3)).toThrow();
  });

  it('tire dans une liste, avec ou sans poids', () => {
    const random = createRandom(3);
    expect(['a', 'b']).toContain(pick(random, ['a', 'b']));
    expect(() => pick(random, [])).toThrow();
    for (let i = 0; i < 50; i++) expect(weightedPick(random, ['a', 'b', 'c'], [0, 1, 0])).toBe('b');
    expect(() => weightedPick(random, ['a'], [0])).toThrow();
    expect(() => weightedPick(random, ['a'], [-1])).toThrow();
  });

  it('respecte les proportions des poids', () => {
    const random = createRandom(11);
    let heavy = 0;
    for (let i = 0; i < 4000; i++) if (weightedPick(random, ['x', 'y'], [3, 1]) === 'x') heavy++;
    expect(heavy / 4000).toBeGreaterThan(0.7);
    expect(heavy / 4000).toBeLessThan(0.8);
  });
});
