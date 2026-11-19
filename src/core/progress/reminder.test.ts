import { describe, expect, it } from 'vitest';
import { nextReminder, parseTime, type ReminderInput } from './reminder';

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, 20 + day, hour, minute).getTime();

const base: ReminderInput = {
  now: at(0, 10),
  settings: { enabled: true, time: '19:00' },
  goalReachedToday: false,
  minutesLeftToday: 7,
  dueCountAt: () => 0,
};

describe('rappel quotidien', () => {
  it('est désactivé par défaut, ou si l’heure est invalide', () => {
    expect(nextReminder({ ...base, settings: { enabled: false, time: '19:00' } })).toBeNull();
    expect(nextReminder({ ...base, settings: { enabled: true, time: '25:00' } })).toBeNull();
    expect(parseTime('07:30')).toEqual([7, 30]);
    expect(parseTime('7:30')).toBeNull();
  });

  it('tombe aujourd’hui s’il reste des révisions ou du temps de pratique', () => {
    expect(nextReminder(base)).toEqual({
      at: at(0, 19),
      body: 'Encore 7 min pour atteindre ton objectif du jour.',
    });
    expect(nextReminder({ ...base, goalReachedToday: true, dueCountAt: () => 3 })).toEqual({
      at: at(0, 19),
      body: '3 révisions t’attendent : quelques minutes suffisent.',
    });
  });

  it('passe au lendemain quand tout est fait, ou quand l’heure est passée', () => {
    const done = nextReminder({ ...base, goalReachedToday: true });
    expect(done).toEqual({ at: at(1, 19), body: 'Ta séance du jour t’attend.' });
    const late = nextReminder({
      ...base,
      now: at(0, 21),
      dueCountAt: (time) => (time >= at(1, 0) ? 1 : 0),
    });
    expect(late).toEqual({
      at: at(1, 19),
      body: '1 révision t’attend : quelques minutes suffisent.',
    });
  });
});
