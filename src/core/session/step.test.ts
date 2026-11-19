import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { getStep, stepsOfTrack, type StepDef } from '../curriculum';
import { sequenceEvents } from '../exercise/intervalQuestion';
import { selectWithFocus, type AskedItem } from '../exercise/selection';
import { createRandom } from '../random';
import { INTERVALS, type IntervalCode } from '../theory';
import {
  choicesFor,
  comparisonExamples,
  contrastComplete,
  createTestPlan,
  discoveryExamples,
  evaluateTest,
  generationFor,
  longestRun,
  nextStepQuestion,
  phaseAfter,
  phasesOf,
  testLength,
  trainingDifficulty,
  trainingReadiness,
  type StepResult,
} from './step';

const step = (id: string): StepDef => {
  const found = getStep(id);
  if (!found) throw new Error(id);
  return found;
};
const results = (pattern: string, item: IntervalCode = 'P4'): StepResult[] =>
  [...pattern].map((c) => ({ item, correct: c === '1' }));
const allSteps = stepsOfTrack('intervals');

describe('phases', () => {
  it('saute la comparaison quand tous les éléments sont nouveaux', () => {
    expect(phasesOf(step('int.asc.01'))).toEqual(['discover', 'train', 'test']);
    expect(phasesOf(step('int.asc.02'))).toEqual(['discover', 'contrast', 'train', 'test']);
    expect(phaseAfter(step('int.asc.01'), 'discover')).toBe('train');
    expect(phaseAfter(step('int.asc.02'), 'discover')).toBe('contrast');
    expect(phaseAfter(step('int.asc.02'), 'contrast')).toBe('train');
  });

  it('propose le nouvel élément et ses voisins en comparaison, tout l’ensemble ensuite', () => {
    expect(choicesFor(step('int.asc.02'), 'contrast')).toEqual(['M3', 'P4', 'P5']);
    expect(choicesFor(step('int.asc.03'), 'contrast')).toEqual(['m3', 'M3']);
    expect(choicesFor(step('int.asc.03'), 'train')).toEqual(['m3', 'M3', 'P4', 'P5', 'P8']);
  });
});

describe('contrastComplete', () => {
  it('s’arrête à 8 bonnes réponses sur les 10 dernières, ou après 20 questions', () => {
    expect(contrastComplete(results('1111111'))).toBe(false);
    expect(contrastComplete(results('11111111'))).toBe(true);
    expect(contrastComplete(results('0011111111'))).toBe(true);
    expect(contrastComplete(results('0101010101010101010'))).toBe(false);
    expect(contrastComplete(results('01010101010101010101'))).toBe(true);
  });
});

describe('trainingReadiness', () => {
  it('attend 85 % sur 20 réponses et 5 passages du nouvel élément', () => {
    const s = step('int.asc.02');
    const others = (n: number): StepResult[] =>
      Array.from({ length: n }, () => ({ item: 'M3', correct: true }));
    expect(trainingReadiness(s, [...others(19)]).ready).toBe(false);
    expect(trainingReadiness(s, [...others(16), ...results('1111')]).ready).toBe(false);
    const ready = trainingReadiness(s, [...others(15), ...results('11111')]);
    expect(ready).toMatchObject({ recentAccuracy: 1, newItemCounts: { P4: 5 }, ready: true });
    const tooManyErrors = [...others(11), ...results('11111'), ...results('0000', 'M3')];
    expect(trainingReadiness(s, tooManyErrors).ready).toBe(false);
  });
});

describe('ajustement de la difficulté', () => {
  it('simplifie sous 65 % et corse au-dessus de 90 % sur les 10 dernières réponses', () => {
    expect(trainingDifficulty(results('000000000'))).toBe('normal');
    expect(trainingDifficulty(results('1111100000'))).toBe('easier');
    expect(trainingDifficulty(results('1111111000'))).toBe('normal');
    expect(trainingDifficulty(results('1111111111'))).toBe('harder');
    const s = step('int.asc.05');
    expect(generationFor(s, 'normal')).toEqual(s.generation);
    expect(generationFor(s, 'easier')).toEqual({ range: [55, 74], tempo: 'slow' });
    expect(generationFor(s, 'harder')).toEqual({ range: [48, 84], tempo: 'fast' });
  });
});

describe('plan du test', () => {
  it('compte 4 questions par réponse possible, entre 12 et 30', () => {
    expect(testLength(step('int.asc.01'))).toBe(12);
    expect(testLength(step('int.asc.02'))).toBe(16);
    expect(testLength(step('int.asc.10'))).toBe(30);
  });

  it('respecte la longueur, la part du nouvel élément et la limite des répétitions', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...allSteps), (seed, s) => {
        const plan = createTestPlan(s, createRandom(seed));
        expect(plan).toHaveLength(testLength(s));
        expect(longestRun(plan)).toBeLessThanOrEqual(3);
        for (const item of plan) expect(s.answers).toContain(item);
        const focus = plan.filter((item) => s.newItems.includes(item)).length;
        if (s.column === 1) {
          // Tous nouveaux : chacun le même nombre de fois.
          for (const item of s.newItems) expect(plan.filter((i) => i === item)).toHaveLength(4);
        } else {
          expect(focus).toBe(Math.round(plan.length * 0.3));
          // Les autres éléments sont tous représentés quand la place le permet.
          const others = s.answers.filter((item) => !s.newItems.includes(item));
          if (plan.length - focus >= others.length) {
            for (const item of others) expect(plan).toContain(item);
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('evaluateTest', () => {
  it('exige 90 % au total et 75 % sur chaque nouvel élément', () => {
    const s = step('int.asc.02');
    const known = (correct: number, total: number): StepResult[] =>
      Array.from({ length: total }, (_, i) => ({ item: 'P5', correct: i < correct }));
    expect(evaluateTest(s, [...known(11, 11), ...results('11110')]).passed).toBe(true);
    expect(evaluateTest(s, [...known(10, 11), ...results('11110')]).passed).toBe(false);
    const weakNew = evaluateTest(s, [...known(20, 20), ...results('11000')]);
    expect(weakNew).toMatchObject({ passed: false, newItemAccuracy: { P4: 0.4 } });
    expect(weakNew.accuracy).toBeCloseTo(22 / 25);
    expect(evaluateTest(s, []).passed).toBe(false);
  });
});

describe('selectWithFocus', () => {
  it('met en avant les nouveaux éléments dans la proportion demandée', () => {
    const random = createRandom(31);
    const items: IntervalCode[] = ['M3', 'P4', 'P5', 'P8'];
    const history: AskedItem<IntervalCode>[] = [];
    for (let i = 0; i < 2000; i++) {
      history.push({ item: selectWithFocus(items, ['P4'], 0.4, history, random), correct: true });
    }
    const share = history.filter((entry) => entry.item === 'P4').length / history.length;
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.45);
    expect(longestRun(history.map((entry) => entry.item))).toBeLessThanOrEqual(3);
  });
});

describe('nextStepQuestion', () => {
  it('pose une question cohérente avec la phase', () => {
    const s = step('int.desc.03');
    const random = createRandom(5);
    const contrast = nextStepQuestion({
      step: s,
      phase: 'contrast',
      history: [],
      phaseResults: [],
      random,
      previousAnchor: null,
    });
    expect(contrast.choices).toEqual(['m3', 'M3']);
    expect(contrast.presentation).toBe('desc');
    const test = nextStepQuestion({
      step: s,
      phase: 'test',
      history: [],
      phaseResults: [],
      random,
      previousAnchor: contrast.anchor,
      plannedItem: 'P8',
    });
    expect(test.item).toBe('P8');
    expect(test.choices).toEqual(s.answers);
    const easy = nextStepQuestion({
      step: s,
      phase: 'train',
      history: [],
      phaseResults: results('0000000000'),
      random,
      previousAnchor: null,
    });
    expect(easy.tempo).toBe('slow');
    expect(Math.abs((easy.midi[0] as number) - (easy.midi[1] as number))).toBe(
      INTERVALS[easy.item as IntervalCode].semitones,
    );
  });
});

describe('exemples de découverte', () => {
  it('joue l’élément sur des notes de départ toutes différentes', () => {
    const s = step('int.desc.02');
    const examples = discoveryExamples(s, 'P4', createRandom(3));
    expect(examples).toHaveLength(4);
    for (const example of examples) {
      expect((example.midi[0] as number) - (example.midi[1] as number)).toBe(5);
    }
    for (let i = 1; i < examples.length; i++) {
      expect(examples[i]?.midi[0]).not.toBe(examples[i - 1]?.midi[0]);
    }
  });

  it('compare des éléments depuis la même note, dans le registre', () => {
    const s = step('int.asc.01');
    const sounds = comparisonExamples(s, ['M3', 'P5', 'P8'], createRandom(8));
    expect(sounds).toHaveLength(6);
    expect(
      sounds.slice(0, 3).map((sound) => (sound.midi[1] as number) - (sound.midi[0] as number)),
    ).toEqual([4, 7, 12]);
    expect(new Set(sounds.slice(0, 3).map((sound) => sound.midi[0])).size).toBe(1);
    for (const sound of sounds) expect(Math.max(...sound.midi)).toBeLessThanOrEqual(77);
  });

  it('enchaîne les sons avec une pause', () => {
    const sounds = discoveryExamples(step('int.asc.01'), 'M3', createRandom(1), 2);
    const events = sequenceEvents(sounds, 0.5);
    expect(events.map((event) => event.start)).toEqual([0, 1, 2.4, 3.4]);
  });
});

describe('étapes d’accords et de renversements', () => {
  it('se limite à l’entraînement et au test sans nouvel élément (R4)', () => {
    expect(phasesOf(step('inv.block.04'))).toEqual(['train', 'test']);
    expect(phasesOf(step('inv.block.01'))).toEqual(['discover', 'train', 'test']);
    expect(phasesOf(step('inv.block.02'))).toEqual(['discover', 'contrast', 'train', 'test']);
    expect(phasesOf(step('tri.arp.02'))).toEqual(['discover', 'contrast', 'train', 'test']);
  });

  it('propose les renversements comme réponses', () => {
    const s = step('inv.block.02');
    expect(choicesFor(s, 'contrast')).toEqual(['inv1', 'inv2']);
    expect(choicesFor(s, 'train')).toEqual(['inv0', 'inv1', 'inv2']);
    const question = nextStepQuestion({
      step: s,
      phase: 'train',
      history: [],
      phaseResults: [],
      random: createRandom(4),
      previousAnchor: null,
    });
    expect(question.choices).toEqual(['inv0', 'inv1', 'inv2']);
    expect(question.answer).toBe(`inv${question.item.split('.')[1]}`);
  });

  it('pose au moins deux questions par nouvel élément au test', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        for (const id of ['inv.block.06', 'tri.arp.01', 'sev.inv.05', 'inv.block.04']) {
          const s = step(id);
          const plan = createTestPlan(s, createRandom(seed));
          expect(plan).toHaveLength(testLength(s));
          for (const item of s.newItems) {
            expect(plan.filter((p) => p === item).length).toBeGreaterThanOrEqual(2);
          }
          for (const item of plan) expect(s.items).toContain(item);
          expect(longestRun(plan)).toBeLessThanOrEqual(3);
        }
      }),
      { numRuns: 30 },
    );
    expect(testLength(step('inv.block.06'))).toBe(30);
  });

  it('découvre un accord sur des basses différentes, et compare sur la même fondamentale', () => {
    const s = step('tri.block.02');
    const examples = discoveryExamples(s, 'dim', createRandom(2));
    for (let i = 1; i < examples.length; i++) {
      expect(examples[i]?.anchor).not.toBe(examples[i - 1]?.anchor);
    }
    const sounds = comparisonExamples(s, ['min', 'dim'], createRandom(5));
    expect(sounds).toHaveLength(4);
    expect(sounds[0]?.midi[0]).toBe(sounds[1]?.midi[0]);
  });
});
