import { DAILY_GOAL_CHOICES } from '../../core/progress/activity';
import { Link } from 'react-router';
import { OptionGroup } from '../components/OptionGroup';
import { ReminderPreference } from './ReminderPreference';
import { TimbrePreference } from './TimbrePreference';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle } from '../styles';

export function PreferencesPanel() {
  const { settings, updateSettings } = useSettings();
  return (
    <section className={card} aria-labelledby="preferences">
      <h2 id="preferences" className={cardTitle}>
        Préférences
      </h2>
      <OptionGroup
        legend="Objectif quotidien"
        value={String(settings.dailyGoalMinutes)}
        options={DAILY_GOAL_CHOICES.map((minutes) => ({
          value: String(minutes),
          label: `${minutes} min`,
        }))}
        onChange={(value) => updateSettings({ dailyGoalMinutes: Number(value) })}
      />
      <ReminderPreference />
      <Link to="/reperes" className="font-medium underline underline-offset-4">
        Mes chansons repères
      </Link>
      <OptionGroup
        legend="Thème"
        value={settings.theme}
        options={[
          { value: 'system', label: 'Système' },
          { value: 'light', label: 'Clair' },
          { value: 'dark', label: 'Sombre' },
        ]}
        onChange={(theme) => updateSettings({ theme })}
      />
      <TimbrePreference />
      <OptionGroup
        legend="Noms des notes"
        value={settings.noteNames}
        options={[
          { value: 'fr', label: 'Do Ré Mi' },
          { value: 'en', label: 'C D E' },
        ]}
        onChange={(noteNames) => updateSettings({ noteNames })}
      />
      <OptionGroup
        legend="Numérotation des octaves"
        value={settings.octaveConvention}
        options={[
          { value: 'fr', label: 'Française (do central = 3)' },
          { value: 'scientific', label: 'Scientifique (do central = 4)' },
        ]}
        onChange={(octaveConvention) => updateSettings({ octaveConvention })}
      />
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-amber-500"
          checked={settings.autoAdvance}
          onChange={(event) => updateSettings({ autoAdvance: event.target.checked })}
        />
        Passer seul à la question suivante après une bonne réponse
      </label>
    </section>
  );
}
