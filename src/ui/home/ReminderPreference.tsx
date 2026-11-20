import { useState } from 'react';
import { remindersAvailable, requestReminderPermission } from '../../platform/reminders';
import { useSettings } from '../settings/settingsContext';
import { muted } from '../styles';

/**
 * Rappel quotidien (Android, §10.7) : à l'heure choisie, seulement si des
 * révisions sont dues ou si l'objectif du jour n'est pas atteint.
 */
export function ReminderPreference() {
  const { settings, updateSettings } = useSettings();
  const [denied, setDenied] = useState(false);
  if (!remindersAvailable()) return null;
  const { reminder } = settings;

  async function toggle(enabled: boolean) {
    setDenied(false);
    if (enabled && !(await requestReminderPermission())) {
      setDenied(true);
      return;
    }
    updateSettings({ reminder: { ...reminder, enabled } });
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
        Rappel quotidien
      </legend>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-amber-500"
          checked={reminder.enabled}
          onChange={(event) => void toggle(event.target.checked)}
        />
        Me le rappeler chaque jour à
        <input
          type="time"
          step={300}
          value={reminder.time}
          disabled={!reminder.enabled}
          aria-label="Heure du rappel"
          className="min-h-11 rounded-lg border border-slate-300 px-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
          onChange={(event) => {
            if (event.target.value)
              updateSettings({ reminder: { ...reminder, time: event.target.value } });
          }}
        />
      </label>
      <p className={`text-sm ${muted}`}>
        Seulement si des révisions t'attendent ou si l'objectif du jour n'est pas atteint.
      </p>
      {denied && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          Les notifications sont refusées : autorise-les pour Oreille musicale dans les réglages
          d'Android.
        </p>
      )}
    </fieldset>
  );
}
