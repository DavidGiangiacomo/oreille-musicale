import { useState } from 'react';
import { useNavigate } from 'react-router';
import { sortIntervals } from '../../core/exercise/intervalQuestion';
import type { IntervalPresentation } from '../../core/exercise/rendition';
import { DEFAULT_SERIES_LENGTH } from '../../core/session/series';
import { INTERVAL_CODES, INTERVALS, type IntervalCode } from '../../core/theory';
import { requestPersistentStorage } from '../../platform/storage';
import { audioEngine } from '../audio';
import { intervalName } from '../format';
import { OptionGroup } from '../components/OptionGroup';
import { seriesPath } from '../series/seriesParams';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted, primaryButton, toggleButton } from '../styles';

const PRESENTATIONS: readonly { value: IntervalPresentation; label: string }[] = [
  { value: 'asc', label: 'Ascendants' },
  { value: 'desc', label: 'Descendants' },
  { value: 'harm', label: 'Harmoniques' },
];

const FIRST_LANDMARKS: IntervalCode[] = ['M3', 'P5', 'P8'];

const PRESETS: readonly { label: string; items: IntervalCode[] }[] = [
  { label: 'Premiers repères (3M, 5J, 8J)', items: FIRST_LANDMARKS },
  { label: 'Les 12 intervalles', items: [...INTERVAL_CODES] },
];

const LAST_CHOICE_KEY = 'oreille-musicale:derniere-serie';

interface Choice {
  presentation: IntervalPresentation;
  items: IntervalCode[];
}

/** Dernier choix de série, mémorisé sur cet appareil pour gagner du temps. */
function loadLastChoice(): Choice {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_CHOICE_KEY) ?? 'null') as Partial<Choice>;
    const items = sortIntervals(Array.isArray(stored?.items) ? stored.items : []);
    const presentation = PRESENTATIONS.some((p) => p.value === stored?.presentation)
      ? (stored.presentation as IntervalPresentation)
      : 'asc';
    return { presentation, items: items.length > 0 ? items : FIRST_LANDMARKS };
  } catch {
    return { presentation: 'asc', items: FIRST_LANDMARKS };
  }
}

function saveLastChoice(choice: Choice) {
  try {
    localStorage.setItem(LAST_CHOICE_KEY, JSON.stringify(choice));
  } catch {
    // Stockage indisponible (navigation privée…) : le choix n'est simplement pas retenu.
  }
}

export function SeriesLauncher() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [initial] = useState(loadLastChoice);
  const [presentation, setPresentation] = useState(initial.presentation);
  const [items, setItems] = useState(initial.items);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(item: IntervalCode) {
    setItems((current) =>
      current.includes(item)
        ? current.length > 1
          ? current.filter((code) => code !== item)
          : current
        : sortIntervals([...current, item]),
    );
  }

  async function start() {
    setError(null);
    try {
      // Le clic sert de geste utilisateur : il débloque l'audio pour toute la série.
      await audioEngine.unlock();
      void requestPersistentStorage();
      if (!audioEngine.isLoaded(settings.instrument)) {
        setProgress(0);
        await audioEngine.load(settings.instrument, setProgress);
      }
      saveLastChoice({ presentation, items });
      void navigate(seriesPath(presentation, items));
    } catch {
      setError(
        'Le son n’a pas pu démarrer. Vérifie ta connexion et réessaie, ou choisis le son pur.',
      );
    } finally {
      setProgress(null);
    }
  }

  return (
    <section className={card} aria-labelledby="nouvelle-serie">
      <h2 id="nouvelle-serie" className={cardTitle}>
        Nouvelle série
      </h2>

      <OptionGroup
        legend="Intervalles"
        value={presentation}
        options={PRESENTATIONS}
        onChange={setPresentation}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
          À reconnaître ({items.length})
        </legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => setItems(preset.items)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {INTERVAL_CODES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={items.includes(item)}
              aria-label={intervalName(item)}
              title={intervalName(item)}
              onClick={() => toggle(item)}
              className={toggleButton}
            >
              {INTERVALS[item].abbreviation}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        className={primaryButton}
        onClick={() => void start()}
        disabled={progress !== null}
      >
        Commencer · {DEFAULT_SERIES_LENGTH} questions
      </button>
      {progress !== null && (
        <p role="status" className={muted}>
          Chargement du piano… {Math.round(progress * 100)} %
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
