import { describe, expect, it } from 'vitest';
import type { Activity, Attempt } from '../journal';
import { applyReview, DAY, enterReview } from '../srs';
import {
  activeConfusions,
  confusionBoost,
  confusionMatrix,
  DUEL_LENGTH,
  pendingDuels,
} from './confusion';

const T0 = new Date(2026, 10, 20, 10).getTime();
let counter = 0;

function answer(
  played: string,
  answered: string,
  at: number,
  options: {
    presentation?: string;
    activity?: Activity;
    sessionId?: string;
    choices?: string[];
  } = {},
): Attempt {
  const { presentation = 'asc', activity = 'free', sessionId = 's', choices } = options;
  return {
    id: `a${++counter}`,
    sessionId,
    at,
    activity,
    competenceId: `int:${played}:${presentation}`,
    rendition: {
      midi: [60, 69],
      spelling: ['C4', 'A4'],
      presentation: 'asc',
      instrument: 'piano',
      tempo: 'normal',
    },
    ...(choices ? { choices } : {}),
    answer: { type: 'choice', value: answered },
    correct: played === answered,
    responseTimeMs: 2000,
    replays: 0,
    helpUsed: false,
  };
}

/** `n` réponses à `played`, dont `errors` répondues `answered`, une par minute. */
function series(played: string, answered: string, n: number, errors: number, start = T0) {
  return Array.from({ length: n }, (_, i) =>
    answer(played, i < errors ? answered : played, start + i * 60_000),
  );
}

describe('confusionMatrix', () => {
  it('compte les couples par contexte sur 60 jours, hors duels', () => {
    const attempts = [
      answer('M6', 'm7', T0),
      answer('M6', 'M6', T0 + 1),
      answer('M6', 'm7', T0 + 2, { presentation: 'desc' }),
      answer('M6', 'm7', T0 + 3, { activity: 'duel' }),
      answer('M6', 'm7', T0 - 61 * DAY),
    ];
    const matrix = confusionMatrix(attempts, T0 + 10);
    expect([...matrix.get('int:asc')!.get('M6')!]).toEqual([
      ['m7', 1],
      ['M6', 1],
    ]);
    expect(matrix.get('int:desc')?.get('M6')?.get('m7')).toBe(1);
  });
});

describe('activeConfusions', () => {
  it('exige 3 erreurs et 20 % des 20 dernières apparitions', () => {
    expect(activeConfusions(series('M6', 'm7', 10, 2), T0 + DAY)).toEqual([]);
    const active = activeConfusions(series('M6', 'm7', 10, 3), T0 + DAY);
    expect(active).toMatchObject([{ context: 'int:asc', played: 'M6', answered: 'm7', errors: 3 }]);
    // 3 erreurs anciennes noyées dans 20 bonnes réponses récentes : plus active.
    const healed = [...series('M6', 'm7', 3, 3), ...series('M6', 'M6', 20, 0, T0 + 3600_000)];
    expect(activeConfusions(healed, T0 + DAY)).toEqual([]);
  });
});

describe('pendingDuels', () => {
  it('déclenche un duel sur une confusion répétée, jusqu’à ce qu’il soit fait', () => {
    const confused = series('M6', 'm7', 8, 4);
    const duels = pendingDuels(confused, new Map(), T0 + DAY);
    expect(duels).toEqual([
      { context: 'int:asc', pair: ['M6', 'm7'], reason: 'confusion', errors: 4 },
    ]);

    const duel = Array.from({ length: DUEL_LENGTH }, (_, i) =>
      answer(i % 2 ? 'M6' : 'm7', i % 2 ? 'M6' : 'm7', T0 + DAY + i * 1000, {
        activity: 'duel',
        sessionId: 'duel',
        choices: ['M6', 'm7'],
      }),
    );
    expect(pendingDuels([...confused, ...duel], new Map(), T0 + DAY + DAY / 2)).toEqual([]);
    // Un duel interrompu ne compte pas.
    expect(pendingDuels([...confused, ...duel.slice(0, 6)], new Map(), T0 + 2 * DAY)).toHaveLength(
      1,
    );
    // Une nouvelle erreur après le duel le reprogramme.
    const relapse = answer('m7', 'M6', T0 + 2 * DAY);
    expect(pendingDuels([...confused, ...duel, relapse], new Map(), T0 + 2 * DAY)).toHaveLength(1);
  });

  it('programme un duel ciblé après un oubli en révision', () => {
    const reviews = new Map(
      ['M3', 'P4', 'P5', 'P8'].map((item) => {
        const id = `int:${item}:asc`;
        return [id, enterReview(id, T0 - 5 * DAY, 3)];
      }),
    );
    reviews.set('int:P4:asc', applyReview(reviews.get('int:P4:asc')!, T0, 1));
    // Sans confusion connue : l'intervalle acquis le plus proche.
    expect(pendingDuels([], reviews, T0 + 1)).toEqual([
      { context: 'int:asc', pair: ['M3', 'P4'], reason: 'lapse', errors: 0 },
    ]);
    // Avec une confusion connue : celle-ci.
    const errors = [answer('P4', 'P5', T0 - 1000)];
    expect(pendingDuels(errors, reviews, T0 + 1)[0]?.pair).toEqual(['P4', 'P5']);
  });

  it('renforce les éléments confondus', () => {
    const boost = confusionBoost(activeConfusions(series('M6', 'm7', 8, 4), T0 + DAY), 'int:asc');
    expect([...boost]).toEqual([
      ['M6', 1],
      ['m7', 1],
    ]);
  });
});
