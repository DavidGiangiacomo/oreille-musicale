import { describe, expect, it } from 'vitest';
import type { Attempt } from '../journal';
import { shiftDay, studyDay } from '../srs/time';
import { activeTimeByDay, currentStreak, RESUME_CREDIT_MS } from './activity';

const at = (day: number, hour = 10, second = 0) =>
  new Date(2026, 10, 20 + day, hour, 0, second).getTime();
const attemptAt = (time: number) => ({ at: time }) as Attempt;
const MIN = 60_000;

describe('activeTimeByDay', () => {
  it('compte les écarts d’une minute au plus, et 10 s après une pause', () => {
    const times = [at(0, 10, 0), at(0, 10, 20), at(0, 10, 50), at(0, 11, 0), at(0, 11, 30)];
    const days = activeTimeByDay(times.map(attemptAt));
    expect(days.get('2026-11-20')).toBe(
      RESUME_CREDIT_MS + 20_000 + 30_000 + RESUME_CREDIT_MS + 30_000,
    );
  });

  it('range une séance après minuit dans la veille', () => {
    const days = activeTimeByDay([at(1, 1, 0), at(1, 1, 30)].map(attemptAt));
    expect([...days.keys()]).toEqual(['2026-11-20']);
  });
});

describe('currentStreak', () => {
  const goal = 10 * MIN;
  const today = at(10);
  /** Jours relatifs à aujourd'hui (0, -1, -2…) où l'objectif est atteint. */
  const activity = (offsets: number[]) =>
    new Map(offsets.map((offset) => [shiftDay(studyDay(today), offset), goal]));

  it('compte les jours d’affilée, aujourd’hui compris s’il est atteint', () => {
    expect(currentStreak(activity([0, -1, -2]), goal, today)).toEqual({ days: 3, today: true });
    // La journée n'est pas finie : la série d'hier tient toujours.
    expect(currentStreak(activity([-1, -2]), goal, today)).toEqual({ days: 2, today: false });
    // Hier manqué, mais c'est le jour de repos de la semaine : la série tient.
    expect(currentStreak(activity([-2, -3]), goal, today)).toEqual({ days: 2, today: false });
    expect(currentStreak(activity([-3, -4]), goal, today).days).toBe(0);
    expect(currentStreak(new Map(), goal, today).days).toBe(0);
  });

  it('tolère un jour de repos par semaine', () => {
    expect(currentStreak(activity([0, -1, -3, -4]), goal, today).days).toBe(4);
    // Deux repos à moins de 7 jours d'écart : la série s'arrête au second.
    expect(currentStreak(activity([0, -2, -4, -5]), goal, today).days).toBe(2);
    // Deux repos espacés d'une semaine : la série continue.
    expect(currentStreak(activity([0, -1, -3, -4, -5, -6, -7, -8, -10]), goal, today).days).toBe(9);
    // Deux jours manqués de suite : fin de la série.
    expect(currentStreak(activity([0, -3, -4]), goal, today).days).toBe(1);
  });

  it('ne compte pas un jour sous l’objectif', () => {
    const days = activity([0, -1]);
    days.set(shiftDay(studyDay(today), -2), goal - 1);
    days.set(shiftDay(studyDay(today), -3), goal);
    expect(currentStreak(days, goal, today).days).toBe(3);
  });
});
