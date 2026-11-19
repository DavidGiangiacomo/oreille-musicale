import { describe, expect, it } from 'vitest';
import { STEPS, stepsOfTrack } from '../curriculum';
import type { Attempt, ProgressEvent } from '../journal';
import { projectSteps } from '../progress/projection';
import { createRandom } from '../random';
import { DAY, enterReview } from '../srs';
import { planDailySession } from './daily';

const T0 = new Date(2026, 10, 20, 10).getTime();

function wrong(played: string, answered: string, at: number): Attempt {
  return {
    id: `${played}-${at}`,
    sessionId: 's',
    at,
    activity: 'free',
    competenceId: `int:${played}:asc`,
    rendition: {
      midi: [60, 64],
      spelling: ['C4', 'E4'],
      presentation: 'asc',
      instrument: 'piano',
      tempo: 'normal',
    },
    answer: { type: 'choice', value: answered },
    correct: false,
    responseTimeMs: 2000,
    replays: 0,
    helpUsed: false,
  };
}

describe('planDailySession', () => {
  const events: ProgressEvent[] = [
    {
      id: 'v1',
      at: T0,
      type: 'step_validated',
      stepId: 'int.asc.01',
      score: 1,
      competenceIds: ['int:M3:asc', 'int:P5:asc', 'int:P8:asc'],
    },
  ];
  const reviews = new Map(
    ['M3', 'P5', 'P8'].map((item) => {
      const id = `int:${item}:asc`;
      return [id, enterReview(id, T0, 3)];
    }),
  );
  const stepStates = projectSteps(STEPS, events);

  it('enchaîne révisions dues, duels, puis l’étape suivante', () => {
    const attempts = [0, 1, 2].map((i) => wrong('P5', 'P8', T0 + DAY + i * 1000));
    const plan = planDailySession({
      reviews,
      attempts,
      steps: stepsOfTrack('intervals'),
      stepStates,
      at: T0 + 3 * DAY,
      random: createRandom(1),
    });
    expect(plan.review.dueIds).toHaveLength(3);
    expect(plan.blocks.map((b) => b.kind)).toEqual(['review', 'duel']);
    expect(plan.duels[0]?.choices).toEqual(['P5', 'P8']);
    expect(plan.step?.id).toBe('int.asc.02');
    expect(plan.estimatedMinutes).toBeGreaterThan(1);
  });

  it('se limite à l’étape quand rien n’est dû', () => {
    const plan = planDailySession({
      reviews,
      attempts: [],
      steps: stepsOfTrack('intervals'),
      stepStates,
      at: T0 + DAY,
      random: createRandom(2),
    });
    expect(plan.blocks).toEqual([]);
    expect(plan.estimatedMinutes).toBe(0);
    expect(plan.step?.id).toBe('int.asc.02');
  });
});
