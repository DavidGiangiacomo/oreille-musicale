import { INTERVAL_LANDMARKS, landmarkKey, type LandmarkDirection } from '../../core/curriculum';
import { INTERVAL_CODES, INTERVALS } from '../../core/theory';
import { ScreenHeader } from '../components/ScreenParts';
import { intervalName } from '../format';
import { useSettings } from '../settings/settingsContext';
import { card, muted } from '../styles';

const DIRECTIONS: readonly { direction: LandmarkDirection; label: string }[] = [
  { direction: 'asc', label: 'en montant' },
  { direction: 'desc', label: 'en descendant' },
];

/**
 * Mes chansons repères (§6.1) : un air connu pour chaque intervalle. Les champs vides
 * reprennent la suggestion de l'appli, affichée en grisé.
 */
export function LandmarksScreen() {
  const { settings, updateSettings } = useSettings();

  function update(key: string, value: string) {
    const landmarks = { ...settings.landmarks };
    if (value.trim()) landmarks[key] = value;
    else delete landmarks[key];
    updateSettings({ landmarks });
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <ScreenHeader
        backTo="/"
        backLabel="Accueil"
        title="Mes chansons repères"
        subtitle="Un air que tu connais bien, dont les deux premières notes forment l’intervalle. Laisse vide pour garder la suggestion."
      />
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-amber-500"
          checked={settings.showLandmarks}
          onChange={(event) => updateSettings({ showLandmarks: event.target.checked })}
        />
        Afficher les repères pendant la découverte et après chaque réponse
      </label>
      {INTERVAL_CODES.map((code) => (
        <section key={code} className={card} aria-labelledby={`repere-${code}`}>
          <h2 id={`repere-${code}`} className="font-semibold">
            {intervalName(code)} ({INTERVALS[code].abbreviation})
          </h2>
          {DIRECTIONS.map(({ direction, label }) => {
            const key = landmarkKey(code, direction);
            const suggestion = INTERVAL_LANDMARKS[code][direction];
            return (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className={muted}>{label}</span>
                <input
                  type="text"
                  maxLength={80}
                  value={settings.landmarks[key] ?? ''}
                  placeholder={suggestion ?? 'Pas de suggestion : à toi de trouver'}
                  onChange={(event) => update(key, event.target.value)}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 placeholder:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-400"
                />
              </label>
            );
          })}
        </section>
      ))}
    </main>
  );
}
