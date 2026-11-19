import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { STEPS, type StepDef } from '../../core/curriculum';
import { currentStep, projectSteps, type StepState } from '../../core/progress/projection';
import { journal } from '../data';
import { useSettings } from '../settings/settingsContext';

export interface Progress {
  states: Map<string, StepState>;
  /** Étape à travailler dans les parcours actifs, ou null si tout est validé. */
  current: StepDef | null;
}

/**
 * Progression recalculée depuis le journal, à chaque changement. Undefined
 * pendant le premier chargement.
 */
export function useProgress(): Progress | undefined {
  const events = useLiveQuery(() => journal.events(), []);
  const { settings } = useSettings();
  return useMemo(() => {
    if (events === undefined) return undefined;
    const states = projectSteps(STEPS, events);
    const active = STEPS.filter((step) => settings.activeTracks.includes(step.track));
    return { states, current: currentStep(active, states) };
  }, [events, settings.activeTracks]);
}
