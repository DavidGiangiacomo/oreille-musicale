import { OptionGroup } from '../components/OptionGroup';
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
        legend="Timbre"
        value={settings.instrument}
        options={[
          { value: 'piano', label: 'Piano' },
          { value: 'pure', label: 'Son pur' },
        ]}
        onChange={(instrument) => updateSettings({ instrument })}
      />
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
