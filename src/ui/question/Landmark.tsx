import { landmarkFor } from '../../core/curriculum';
import type { IntervalCode } from '../../core/theory';
import { useSettings } from '../settings/settingsContext';
import { muted } from '../styles';

/** Chanson repère d'un intervalle (§6.1), celle de l'utilisateur en priorité. */
export function Landmark({ code, presentation }: { code: IntervalCode; presentation: string }) {
  const { settings } = useSettings();
  const landmark = landmarkFor(code, presentation, settings.landmarks);
  if (!landmark) return null;
  return (
    <p className={`text-sm ${muted}`}>
      <span aria-hidden="true">♪ </span>Repère : <i>{landmark}</i>
    </p>
  );
}
