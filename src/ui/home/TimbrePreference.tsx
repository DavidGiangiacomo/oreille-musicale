import { useState } from 'react';
import type { TimbreId } from '../../core/exercise/rendition';
import { audioEngine, loadingLabel, prepareAudio, SOUND_CHECK } from '../audio';
import { OptionGroup } from '../components/OptionGroup';
import { useSettings } from '../settings/settingsContext';
import { muted } from '../styles';

const TIMBRE_OPTIONS: readonly { value: TimbreId; label: string }[] = [
  { value: 'piano', label: 'Piano' },
  { value: 'vibraphone', label: 'Vibraphone' },
  { value: 'strings', label: 'Cordes' },
  { value: 'pure', label: 'Son pur' },
];

/**
 * Choix du timbre (§5.1) : le timbre choisi se charge et se fait entendre aussitôt
 * (do-mi-sol-do), ce qui évite une attente au début de l'exercice suivant.
 */
export function TimbrePreference() {
  const { settings, updateSettings } = useSettings();
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(instrument: TimbreId) {
    updateSettings({ instrument });
    setError(null);
    try {
      setLoading(0);
      await prepareAudio(instrument, setLoading);
      audioEngine.play(SOUND_CHECK, { instrument });
    } catch {
      setError('Ce timbre n’a pas pu être chargé. Vérifie ta connexion et réessaie.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <OptionGroup
        legend="Timbre"
        value={settings.instrument}
        options={TIMBRE_OPTIONS}
        columns={2}
        onChange={(instrument) => void choose(instrument)}
      />
      {loading !== null && (
        <p role="status" className={`text-sm ${muted}`}>
          {loadingLabel(settings.instrument, loading)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
