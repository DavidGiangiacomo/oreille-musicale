import { createContext, useContext } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../../core/journal';

export interface SettingsContextValue {
  settings: Settings;
  /** Vrai une fois les réglages enregistrés relus (avant, ce sont les valeurs par défaut). */
  loaded: boolean;
  updateSettings: (changes: Partial<Settings>) => void;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  updateSettings: () => undefined,
});

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
