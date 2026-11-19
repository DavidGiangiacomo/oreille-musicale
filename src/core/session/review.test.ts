import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { applyReview, DAY, enterReview, type ReviewState } from '../srs';
import { longestRun } from './plan';
import { blockQuestion, distractorCount, planDuel, planReview } from './review';

const T0 = new Date(2026, 10, 20, 10).getTime();

/** Compétences entrées en révision au jour 0 (dues au jour 3 avec « Bien »). */
function reviewsOf(ids: string[], grade: 2 | 3 = 3): Map<string, ReviewState> {
  return new Map(ids.map((id) => [id, enterReview(id, T0, grade)]));
}

const asc = ['M3', 'P5', 'P8', 'P4', 'm3'].map((item) => `int:${item}:asc`);

describe('planReview', () => {
  it('ne propose rien avant l’échéance', () => {
    const plan = planReview(reviewsOf(asc), T0 + DAY, createRandom(1));
    expect(plan).toEqual({ blocks: [], dueIds: [], postponed: 0 });
  });

  it('pose 3 questions par compétence due, avec ≈ 30 % de distractrices', () => {
    const reviews = reviewsOf(asc);
    // Deux compétences révisées entre-temps : non dues au jour 3.
    for (const id of ['int:P4:asc', 'int:m3:asc']) {
      reviews.set(id, applyReview(reviews.get(id)!, T0 + 2 * DAY, 3));
    }
    const plan = planReview(reviews, T0 + 3 * DAY, createRandom(2));
    expect(plan.dueIds.sort()).toEqual(['int:M3:asc', 'int:P5:asc', 'int:P8:asc']);
    expect(plan.blocks).toHaveLength(1);
    const [block] = plan.blocks;
    expect(block).toMatchObject({
      kind: 'review',
      context: 'int:asc',
      presentation: 'asc',
      choices: ['m3', 'M3', 'P4', 'P5', 'P8'],
      focus: ['M3', 'P5', 'P8'],
    });
    const count = (item: string) => block!.plan.filter((q) => q === item).length;
    expect([count('M3'), count('P5'), count('P8')]).toEqual([3, 3, 3]);
    expect(count('P4') + count('m3')).toBe(distractorCount(9));
    expect(distractorCount(9)).toBe(4);
    expect(distractorCount(24)).toBe(10);
    expect(longestRun(block!.plan)).toBeLessThanOrEqual(2);
  });

  it('limite la séance à 8 compétences, fragiles d’abord, et regroupe par contexte', () => {
    const ids = [
      ...['M3', 'P5', 'P8', 'P4', 'm3', 'M2'].map((item) => `int:${item}:asc`),
      ...['M3', 'P5', 'P8'].map((item) => `int:${item}:desc`),
      'int:M3:harm',
      'int:P5:harm',
    ];
    const reviews = reviewsOf(ids);
    // int:P8:harm : oubliée à sa dernière révision.
    const lapsed = applyReview(enterReview('int:P8:harm', T0 - 10 * DAY, 3), T0, 1);
    reviews.set('int:P8:harm', lapsed);
    const plan = planReview(reviews, T0 + 10 * DAY, createRandom(3));
    expect(plan.dueIds).toHaveLength(8);
    expect(plan.dueIds[0]).toBe('int:P8:harm');
    expect(plan.postponed).toBe(4);
    expect(plan.blocks.map((b) => b.presentation)).toEqual(
      [...new Set(plan.blocks.map((b) => b.presentation))].sort(
        (a, b) => ['asc', 'desc', 'harm'].indexOf(a) - ['asc', 'desc', 'harm'].indexOf(b),
      ),
    );
    expect(plan.blocks.find((b) => b.presentation === 'harm')?.choices).toEqual(['M3', 'P5', 'P8']);
  });

  it('renforce les paires confondues parmi les distractrices', () => {
    const reviews = reviewsOf(asc);
    for (const id of ['int:P5:asc', 'int:P8:asc', 'int:P4:asc', 'int:m3:asc']) {
      reviews.set(id, applyReview(reviews.get(id)!, T0 + 2 * DAY, 3));
    }
    const plan = planReview(reviews, T0 + 3 * DAY, createRandom(4), {
      boost: () => new Map([['m3', 1]]),
    });
    const block = plan.blocks[0]!;
    expect(block.focus).toEqual(['M3']);
    expect(block.plan.filter((q) => q === 'm3').length).toBeGreaterThanOrEqual(1);
  });

  it('génère des questions valides pour toute graine', () => {
    const reviews = reviewsOf([...asc, 'int:M3:desc', 'int:P5:desc', 'int:P8:desc']);
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const random = createRandom(seed);
        const plan = planReview(reviews, T0 + 3 * DAY, random);
        let previous: number | null = null;
        for (const block of plan.blocks) {
          for (const item of block.plan) {
            const question = blockQuestion(block, item, random, previous);
            expect(question.choices).toContain(question.item);
            expect(question.choices).toEqual(block.choices);
            previous = question.midi[0];
          }
        }
      }),
      { numRuns: 30 },
    );
  });
});

describe('planDuel', () => {
  it('pose 10 questions, 5 sur chaque élément, avec deux réponses', () => {
    const block = planDuel(
      { context: 'int:asc', pair: ['M6', 'm7'], reason: 'confusion', errors: 4 },
      createRandom(5),
    );
    expect(block).toMatchObject({ kind: 'duel', choices: ['M6', 'm7'], presentation: 'asc' });
    expect(block.plan).toHaveLength(10);
    expect(block.plan.filter((q) => q === 'M6')).toHaveLength(5);
    expect(longestRun(block.plan)).toBeLessThanOrEqual(3);
  });
});

describe('révisions d’accords et de renversements', () => {
  it('fait un bloc par contexte, intervalles puis accords puis renversements', () => {
    const reviews = reviewsOf([
      'int:M3:asc',
      'chd:maj:block',
      'chd:min:block',
      'chd:dim:block',
      'chd:maj:arp',
      'inv:maj.0:block',
      'inv:maj.1:block',
    ]);
    const plan = planReview(reviews, T0 + 3 * DAY, createRandom(9));
    expect(plan.blocks.map((b) => b.context)).toEqual([
      'int:asc',
      'chd:arp',
      'chd:block',
      'inv:block',
    ]);
    const chords = plan.blocks[2]!;
    expect(chords.choices).toEqual(['maj', 'min', 'dim']);
    const inversions = plan.blocks[3]!;
    expect(inversions.choices).toEqual(['inv0', 'inv1']);
    expect(inversions.focus).toEqual(['maj.0', 'maj.1']);
    const random = createRandom(1);
    for (const block of plan.blocks) {
      for (const item of block.plan) {
        const question = blockQuestion(block, item, random, null);
        expect(question.choices).toEqual(block.choices);
        expect(block.choices).toContain(question.answer);
      }
    }
  });
});
