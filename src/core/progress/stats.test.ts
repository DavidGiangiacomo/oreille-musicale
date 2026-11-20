import { describe, expect, it } from 'vitest';
import { INTERVALS_TRACK, STEPS } from '../curriculum';
import type { Attempt } from '../journal';
import { applyReview, DAY, enterReview } from '../srs';
import {
  activityCalendar,
  competenceHistory,
  confusionTables,
  masteryGrid,
  practicedCompetences,
  reviewCalibration,
  topConfusions,
} from './stats';
import type { CompetenceState } from './projection';

const T0 = new Date(2026, 10, 20, 10).getTime();
let counter = 0;

function answer(played: string, answered: string, at: number, responseTimeMs = 2000): Attempt {
  return {
    id: `a${++counter}`,
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
    correct: played === answered,
    responseTimeMs,
    replays: 0,
    helpUsed: false,
  };
}

describe('grille de maîtrise', () => {
  it('suit l’ordre du parcours, une colonne par présentation', () => {
    const state = (id: string, level: CompetenceState['level']): [string, CompetenceState] => [
      id,
      {
        id,
        level,
        introducedAt: 0,
        attempts: 0,
        recent: [],
        fragile: false,
        medianResponseTimeMs: null,
        review: null,
      },
    ];
    const grid = masteryGrid(
      INTERVALS_TRACK,
      STEPS,
      new Map([state('int:M3:asc', 3), state('int:P4:desc', 1)]),
    );
    expect(grid.map((row) => row.item).slice(0, 5)).toEqual(['M3', 'P5', 'P8', 'P4', 'm3']);
    expect(grid).toHaveLength(12);
    expect(grid[0]?.cells.map((cell) => cell?.level ?? null)).toEqual([3, null, null]);
    expect(grid[3]?.cells[1]?.level).toBe(1);
  });
});

describe('confusions', () => {
  it('donne une table par contexte et les confusions principales', () => {
    const attempts = [
      answer('M6', 'm7', T0),
      answer('M6', 'm7', T0 + 1),
      answer('m7', 'M6', T0 + 2),
      answer('M6', 'M6', T0 + 3),
      answer('M3', 'P4', T0 + 4),
    ];
    const tables = confusionTables(attempts, T0 + DAY);
    expect(tables).toHaveLength(1);
    const [table] = tables;
    expect(table?.answers).toEqual(['M3', 'P4', 'M6', 'm7']);
    expect(table?.counts[2]).toEqual([0, 0, 1, 2]);
    expect(table?.maxErrors).toBe(2);
    expect(topConfusions(tables)).toEqual([
      { context: 'int:asc', pair: ['M6', 'm7'], errors: 3 },
      { context: 'int:asc', pair: ['M3', 'P4'], errors: 1 },
    ]);
  });
});

describe('progrès d’une compétence', () => {
  it('résume chaque jour pratiqué', () => {
    const attempts = [
      answer('M3', 'M3', T0, 1000),
      answer('M3', 'P5', T0 + 1000),
      answer('M3', 'M3', T0 + 2000, 3000),
      answer('M3', 'M3', T0 + 2 * DAY, 800),
      answer('P5', 'P5', T0),
    ];
    expect(competenceHistory(attempts, 'int:M3:asc')).toEqual([
      { day: '2026-11-20', answered: 3, correct: 2, medianCorrectMs: 2000 },
      { day: '2026-11-22', answered: 1, correct: 1, medianCorrectMs: 800 },
    ]);
    expect(practicedCompetences(attempts)).toEqual(['int:M3:asc', 'int:P5:asc']);
  });
});

describe('activité', () => {
  it('range les jours par semaine, du lundi au dimanche, jusqu’à aujourd’hui', () => {
    // Le 20 novembre 2026 est un vendredi.
    const weeks = activityCalendar(new Map([['2026-11-18', 60_000]]), T0, 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]?.[0]?.day).toBe('2026-11-09');
    expect(weeks[1]?.map((d) => d.day)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ]);
    expect(weeks[1]?.[2]?.activeMs).toBe(60_000);
  });
});

describe('calibration des révisions', () => {
  it('compte les révisions réussies sur la période, hors entrées en révision', () => {
    const entered = enterReview('int:M3:asc', T0 - 40 * DAY, 3);
    const old = applyReview(entered, T0 - 35 * DAY, 3);
    const good = applyReview(old, T0 - 10 * DAY, 3);
    const lapse = applyReview(good, T0 - 2 * DAY, 1);
    expect(reviewCalibration(new Map([['int:M3:asc', lapse]]), T0)).toEqual({
      count: 2,
      passed: 1,
    });
  });
});
