import { createContext, useContext } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../../core/journal';

export interface SettingsContextValue {
  settings: Settings;
  updateSettings: (changes: Partial<Settings>) => void;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => undefined,
});

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
