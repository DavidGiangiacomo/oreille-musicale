import { useEffect, useRef } from 'react';
import { activeTimeByDay } from '../core/progress/activity';
import { nextReminder } from '../core/progress/reminder';
import { dueReviews, projectReviews, studyDay } from '../core/srs';
import { scheduleReminder } from '../platform/reminders';
import { useJournalData } from './progress/useJournalData';
import { useSettings } from './settings/settingsContext';

/**
 * Programme le rappel quotidien (Android) d'après le journal : à chaque réponse ou
 * changement de réglage, le prochain rappel est recalculé et remplace le précédent.
 */
export function ReminderScheduler() {
  const data = useJournalData();
  const { settings, loaded } = useSettings();
  const scheduled = useRef<string | null>(null);

  useEffect(() => {
    if (!data || !loaded) return;
    const reviews = projectReviews(data.events, data.attempts);
    const todayMs = activeTimeByDay(data.attempts).get(studyDay(data.readAt)) ?? 0;
    const goalMs = settings.dailyGoalMinutes * 60_000;
    const reminder = nextReminder({
      now: data.readAt,
      settings: settings.reminder,
      goalReachedToday: todayMs >= goalMs,
      minutesLeftToday: Math.ceil((goalMs - todayMs) / 60_000),
      dueCountAt: (at) => dueReviews(reviews, at).length,
    });
    const key = JSON.stringify(reminder);
    if (key === scheduled.current) return;
    scheduled.current = key;
    scheduleReminder(reminder).catch((error: unknown) => {
      console.error('Rappel impossible à programmer', error);
      scheduled.current = null;
    });
  }, [data, loaded, settings.reminder, settings.dailyGoalMinutes]);

  return null;
}
