import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Activity, Attempt, ProgressEvent } from '../journal';
import {
  autoGrade,
  daysBetween,
  daysUntilDue,
  dueReviews,
  enterReview,
  applyReview,
  entryGrade,
  isDue,
  projectReviews,
  referenceTimeMs,
  shiftDay,
  studyDay,
  type AnswerSample,
} from './index';

/** Instant local : 20 novembre 2026 + `day` jours, à `hour` heures. */
const at = (day: number, hour = 10, minute = 0) =>
  new Date(2026, 10, 20 + day, hour, minute).getTime();

const sample = (correct: boolean, responseTimeMs = 2000, replays = 0): AnswerSample => ({
  correct,
  responseTimeMs,
  replays,
  helpUsed: false,
});

let counter = 0;
function attempt(
  competenceId: string,
  time: number,
  correct: boolean,
  activity: Activity = 'review',
  extra: Partial<Attempt> = {},
): Attempt {
  return {
    id: `a${++counter}`,
    sessionId: 's',
    at: time,
    activity,
    competenceId,
    rendition: {
      midi: [60, 64],
      spelling: ['C4', 'E4'],
      presentation: 'asc',
      instrument: 'piano',
      tempo: 'normal',
    },
    answer: { type: 'choice', value: 'M3' },
    correct,
    responseTimeMs: 2000,
    replays: 0,
    helpUsed: false,
    ...extra,
  };
}
type NewEvent = ProgressEvent extends infer E
  ? E extends ProgressEvent
    ? Omit<E, 'id'>
    : never
  : never;
const event = (e: NewEvent) => ({ ...e, id: `e${++counter}` }) as ProgressEvent;

/** Validation de l'étape 1 ascendante au jour 0 : test parfait sauf 2 erreurs sur 8J. */
function validationAtDay0(): { events: ProgressEvent[]; attempts: Attempt[] } {
  const attempts: Attempt[] = [];
  let time = at(0, 9);
  for (const [item, results] of [
    ['M3', [1, 1, 1, 1]],
    ['P5', [1, 1, 1, 1]],
    ['P8', [1, 1, 0, 0]],
  ] as const) {
    for (const ok of results) {
      attempts.push(
        attempt(`int:${item}:asc`, (time += 1000), ok === 1, 'test', { stepId: 'int.asc.01' }),
      );
    }
  }
  const events = [
    event({ at: at(0, 8, 59), type: 'phase_started', stepId: 'int.asc.01', phase: 'test' }),
    event({
      at: at(0, 9, 30),
      type: 'step_validated',
      stepId: 'int.asc.01',
      score: 10 / 12,
      competenceIds: ['int:M3:asc', 'int:P5:asc', 'int:P8:asc'],
    }),
  ];
  return { events, attempts };
}

describe('jour d’étude', () => {
  it('commence à 4 h du matin', () => {
    expect(studyDay(at(1, 3, 59))).toBe('2026-11-20');
    expect(studyDay(at(1, 4, 0))).toBe('2026-11-21');
    expect(shiftDay('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-20', '2026-12-01')).toBe(11);
  });
});

describe('autoGrade', () => {
  const ref = 2000;
  it('suit la table du document de conception (§8.3)', () => {
    expect(autoGrade([sample(false), sample(false), sample(true)], ref)).toBe(1);
    expect(autoGrade([sample(false), sample(false), sample(false)], ref)).toBe(1);
    expect(autoGrade([sample(true), sample(false), sample(true)], ref)).toBe(2);
    expect(autoGrade([sample(true, 3500), sample(true, 3200), sample(true, 3100)], ref)).toBe(2);
    expect(autoGrade([sample(true), sample(true, 2000, 2), sample(true)], ref)).toBe(2);
    expect(autoGrade([sample(true), sample(true), sample(true)], ref)).toBe(3);
    expect(autoGrade([sample(true, 900), sample(true, 1000), sample(true, 1100)], ref)).toBe(4);
    expect(autoGrade([sample(true, 900), sample(true, 1000, 1), sample(true, 1100)], ref)).toBe(4);
    expect(() => autoGrade([], ref)).toThrow();
  });

  it('prend un temps de référence personnel après 5 bonnes réponses', () => {
    expect(referenceTimeMs([1000, 2000])).toBe(3000);
    expect(referenceTimeMs([1000, 2000, 1500, 1800, 2500])).toBe(1800);
  });

  it('donne une note d’entrée selon la réussite au test (§8.2)', () => {
    expect(entryGrade(1)).toBe(3);
    expect(entryGrade(0.9)).toBe(3);
    expect(entryGrade(0.5)).toBe(2);
  });
});

describe('planification FSRS', () => {
  it('espace les révisions et rapproche après un oubli', () => {
    const entered = enterReview('int:M3:asc', at(0), 3);
    expect(daysUntilDue(entered, at(0))).toBe(3);
    expect(isDue(entered, at(2))).toBe(false);
    expect(isDue(entered, at(3, 5))).toBe(true);
    const good = applyReview(entered, at(3), 3);
    expect(daysUntilDue(good, at(3))).toBeGreaterThan(3);
    const lapse = applyReview(good, at(20), 1);
    expect(lapse).toMatchObject({ lapses: 1, lastGrade: 1 });
    expect(daysUntilDue(lapse, at(20))).toBeLessThan(daysUntilDue(good, at(3)));
    expect(enterReview('x', at(0), 2).due).toBeLessThan(entered.due);
  });
});

describe('projectReviews', () => {
  it('fait entrer les compétences en révision à la validation, selon le test', () => {
    const { events, attempts } = validationAtDay0();
    const states = projectReviews(events, attempts);
    expect([...states.keys()].sort()).toEqual(['int:M3:asc', 'int:P5:asc', 'int:P8:asc']);
    expect(states.get('int:M3:asc')?.history).toEqual([
      { at: at(0, 9, 30), grade: 3, source: 'validation' },
    ]);
    expect(states.get('int:P8:asc')?.lastGrade).toBe(2);
    expect(dueReviews(states, at(1))).toEqual([]);
  });

  it('révise une compétence due après 3 réponses le même jour, quelle que soit l’activité', () => {
    const { events, attempts } = validationAtDay0();
    const day3 = [
      attempt('int:M3:asc', at(3, 10, 0), true, 'review'),
      attempt('int:M3:asc', at(3, 10, 1), true, 'review'),
      attempt('int:M3:asc', at(3, 10, 2), true, 'review'),
      // Révision implicite : entraînement libre.
      attempt('int:P5:asc', at(3, 18, 0), true, 'free'),
      attempt('int:P5:asc', at(3, 18, 1), false, 'free'),
      attempt('int:P5:asc', at(3, 18, 2), true, 'free'),
    ];
    const states = projectReviews(events, [...attempts, ...day3]);
    expect(states.get('int:M3:asc')?.history.map((h) => h.grade)).toEqual([3, 3]);
    expect(states.get('int:P5:asc')?.history.map((h) => [h.grade, h.source])).toEqual([
      [3, 'validation'],
      [2, 'review'],
    ]);
    expect(isDue(states.get('int:M3:asc')!, at(4))).toBe(false);
    // 8J est entrée en Difficile : due plus tôt, et toujours due sans réponse.
    expect(dueReviews(states, at(3)).map((s) => s.competenceId)).toEqual(['int:P8:asc']);
  });

  it('ignore la pratique avant l’échéance et les révisions incomplètes', () => {
    const { events, attempts } = validationAtDay0();
    const extra = [
      attempt('int:M3:asc', at(1), true, 'free'),
      attempt('int:M3:asc', at(1, 11), true, 'free'),
      attempt('int:M3:asc', at(1, 12), true, 'free'),
      // Le jour J : 2 réponses seulement, puis une le lendemain.
      attempt('int:M3:asc', at(3, 10), true),
      attempt('int:M3:asc', at(3, 11), true),
      attempt('int:M3:asc', at(4, 10), true),
    ];
    const state = projectReviews(events, [...attempts, ...extra]).get('int:M3:asc');
    expect(state?.history).toHaveLength(1);
    expect(state && isDue(state, at(4))).toBe(true);
  });

  it('compte une séance après minuit pour la veille', () => {
    const { events, attempts } = validationAtDay0();
    const lateNight = [
      attempt('int:M3:asc', at(3, 23, 50), true),
      attempt('int:M3:asc', at(4, 0, 30), true),
      attempt('int:M3:asc', at(4, 1, 0), true),
    ];
    expect(
      projectReviews(events, [...attempts, ...lateNight]).get('int:M3:asc')?.history,
    ).toHaveLength(2);
  });

  it('rend les compétences ratées fragiles et prioritaires', () => {
    const { events, attempts } = validationAtDay0();
    const day3 = [0, 1, 2].map((i) => attempt('int:M3:asc', at(3, 10, i), false));
    const states = projectReviews(events, [...attempts, ...day3]);
    expect(states.get('int:M3:asc')).toMatchObject({ lastGrade: 1, lapses: 1 });
    const later = at(6);
    expect(dueReviews(states, later)[0]?.competenceId).toBe('int:M3:asc');
  });

  it('donne le même résultat quel que soit l’ordre de lecture du journal', () => {
    const { events, attempts } = validationAtDay0();
    const all = [
      ...attempts,
      ...[0, 1, 2].map((i) => attempt('int:P5:asc', at(3, 10, i), i !== 1)),
      ...[0, 1, 2].map((i) => attempt('int:P8:asc', at(2, 10, i), true)),
    ];
    const reference = projectReviews(events, all);
    fc.assert(
      fc.property(fc.shuffledSubarray(all, { minLength: all.length }), (shuffled) => {
        expect(projectReviews([...events].reverse(), shuffled)).toEqual(reference);
      }),
      { numRuns: 50 },
    );
  });
});
