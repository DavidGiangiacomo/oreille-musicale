// Rappel quotidien (docs/DESIGN.md §9.4 et §10.7) : un par jour au plus, à l'heure
// choisie, seulement si des révisions sont dues ou si l'objectif n'est pas atteint.

export const DEFAULT_REMINDER_TIME = '19:00';

export interface ReminderSettings {
  enabled: boolean;
  /** Heure locale, « HH:MM ». */
  time: string;
}

export const DEFAULT_REMINDER: Readonly<ReminderSettings> = {
  enabled: false,
  time: DEFAULT_REMINDER_TIME,
};

/** « 07:30 » → [7, 30], ou null si l'heure est invalide. */
export function parseTime(time: string): [number, number] | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? [hours, minutes] : null;
}

export interface ReminderInput {
  now: number;
  settings: ReminderSettings;
  /** Objectif du jour déjà atteint. */
  goalReachedToday: boolean;
  /** Minutes de pratique restantes pour l'objectif du jour. */
  minutesLeftToday: number;
  /** Compétences dues à un instant donné (les échéances FSRS sont connues d'avance). */
  dueCountAt: (at: number) => number;
}

export interface Reminder {
  at: number;
  body: string;
}

/** Instant de l'heure du rappel, le jour de `at` décalé de `days` jours. */
function reminderAt(at: number, time: [number, number], days: number): number {
  const date = new Date(at);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    time[0],
    time[1],
  ).getTime();
}

function message(due: number, minutesLeft: number | null): string {
  if (due > 0) {
    return `${due} révision${due > 1 ? 's' : ''} t’attend${due > 1 ? 'ent' : ''} : quelques minutes suffisent.`;
  }
  if (minutesLeft !== null && minutesLeft > 0) {
    return `Encore ${minutesLeft} min pour atteindre ton objectif du jour.`;
  }
  return 'Ta séance du jour t’attend.';
}

/**
 * Prochain rappel à programmer (un seul à la fois, remplacé à chaque changement) :
 * aujourd'hui à l'heure choisie s'il reste quelque chose à faire, sinon demain.
 * Null si les rappels sont désactivés ou l'heure invalide.
 */
export function nextReminder(input: ReminderInput): Reminder | null {
  const { now, settings, goalReachedToday, minutesLeftToday, dueCountAt } = input;
  const time = parseTime(settings.time);
  if (!settings.enabled || !time) return null;

  const today = reminderAt(now, time, 0);
  const dueToday = dueCountAt(today);
  if (today > now && (dueToday > 0 || !goalReachedToday)) {
    return { at: today, body: message(dueToday, goalReachedToday ? null : minutesLeftToday) };
  }
  // Demain, l'objectif n'est pas encore atteint : le rappel a toujours lieu d'être.
  // S'il est atteint avant l'heure, le rappel sera reprogrammé au lendemain.
  const tomorrow = reminderAt(now, time, 1);
  return { at: tomorrow, body: message(dueCountAt(tomorrow), null) };
}
