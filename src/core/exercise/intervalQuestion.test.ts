import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import { INTERVAL_CODES, INTERVALS, midiOf, type IntervalCode } from '../theory';
import {
  createIntervalQuestion,
  DEFAULT_INTERVAL_RANGE,
  intervalSoundFrom,
  sortIntervals,
} from './intervalQuestion';
import type { IntervalPresentation } from './rendition';

const presentation = fc.constantFrom<IntervalPresentation>('asc', 'desc', 'harm');
const choicesWithItem = fc
  .subarray([...INTERVAL_CODES], { minLength: 1 })
  .chain((choices) => fc.tuple(fc.constant(choices), fc.constantFrom(...choices)));

describe('createIntervalQuestion', () => {
  it('respecte registre, taille, sens, choix et fondamentale précédente', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        choicesWithItem,
        presentation,
        fc.option(fc.integer({ min: 53, max: 77 }), { nil: null }),
        (seed, [choices, item], pres, previous) => {
          const q = createIntervalQuestion({
            item,
            presentation: pres,
            choices,
            random: createRandom(seed),
            previousFirstMidi: previous,
          });
          const [first, second] = q.midi;
          const [low, high] = DEFAULT_INTERVAL_RANGE;
          expect(Math.min(first, second)).toBeGreaterThanOrEqual(low);
          expect(Math.max(first, second)).toBeLessThanOrEqual(high);
          expect(Math.abs(second - first)).toBe(INTERVALS[item].semitones);
          expect(pres === 'desc' ? first > second : second > first).toBe(true);
          expect(q.choices).toContain(item);
          expect(q.choices).toEqual(sortIntervals(choices));
          expect(first).not.toBe(previous);
          expect(q.notes.map(midiOf)).toEqual(q.midi);
          expect(q.events.map((e) => e.midi)).toEqual(q.midi);
          expect(q.competenceId).toBe(`int:${item}:${pres}`);
          expect(q.answerType).toBe('choice');
        },
      ),
      { numRuns: 500 },
    );
  });

  it('est reproductible à graine égale', () => {
    const options = {
      item: 'M6' as IntervalCode,
      presentation: 'asc' as const,
      choices: ['M6' as IntervalCode],
    };
    const a = createIntervalQuestion({ ...options, random: createRandom(5) });
    const b = createIntervalQuestion({ ...options, random: createRandom(5) });
    expect(a).toEqual(b);
  });

  it('varie la fondamentale d’une question à l’autre', () => {
    const random = createRandom(9);
    const firsts = new Set<number>();
    for (let i = 0; i < 100; i++) {
      firsts.add(
        createIntervalQuestion({ item: 'P5', presentation: 'asc', choices: ['P5'], random })
          .midi[0],
      );
    }
    expect(firsts.size).toBeGreaterThan(12);
  });

  it('refuse une réponse absente des choix ou un registre trop étroit', () => {
    const random = createRandom(1);
    expect(() =>
      createIntervalQuestion({ item: 'm3', presentation: 'asc', choices: ['M3'], random }),
    ).toThrow();
    expect(() =>
      createIntervalQuestion({
        item: 'P8',
        presentation: 'asc',
        choices: ['P8'],
        random,
        range: [60, 70],
      }),
    ).toThrow();
  });
});

describe('intervalSoundFrom', () => {
  it('joue un autre intervalle depuis la même première note', () => {
    const sound = intervalSoundFrom('D4', 'P4', 'asc');
    expect(sound.notes).toEqual(['D4', 'G4']);
    expect(sound.events.map((e) => e.start)).toEqual([0, 1]);
    expect(intervalSoundFrom('D4', 'M3', 'desc').notes).toEqual(['D4', 'Bb3']);
    expect(intervalSoundFrom('D4', 'P5', 'harm').events.map((e) => e.start)).toEqual([0, 0]);
  });
});
