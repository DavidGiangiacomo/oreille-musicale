import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../../core/journal';
import { applyTheme } from '../../platform/theme';
import { audioEngine } from '../audio';
import { journal } from '../data';
import { SettingsContext } from './settingsContext';

/**
 * Fournit les réglages enregistrés. Un changement s'applique tout de suite à
 * l'écran, puis est enregistré dans la base (écriture asynchrone).
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const stored = useLiveQuery(() => journal.loadSettings(), []);
  const [local, setLocal] = useState<Settings | null>(null);
  const settings = local ?? stored ?? DEFAULT_SETTINGS;

  useEffect(() => {
    audioEngine.setVolume(settings.volume);
  }, [settings.volume]);

  // Thème : appliqué une fois les réglages lus (avant, index.html a posé le dernier connu).
  const loaded = local !== null || stored !== undefined;
  useEffect(() => {
    if (loaded) return applyTheme(settings.theme);
  }, [loaded, settings.theme]);

  const value = useMemo(
    () => ({
      settings,
      loaded,
      updateSettings: (changes: Partial<Settings>) => {
        const next = { ...settings, ...changes };
        setLocal(next);
        void journal.saveSettings(next);
      },
    }),
    [settings, loaded],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
