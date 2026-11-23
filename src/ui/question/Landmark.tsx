import { Fragment } from 'react';
import { landmarksFor } from '../../core/curriculum';
import type { IntervalCode } from '../../core/theory';
import { useSettings } from '../settings/settingsContext';
import { muted } from '../styles';

/** Chansons repères d'un intervalle (§6.1) : celle de l'utilisateur, sinon les suggestions. */
export function Landmark({ code, presentation }: { code: IntervalCode; presentation: string }) {
  const { settings } = useSettings();
  const landmarks = landmarksFor(code, presentation, settings.landmarks);
  if (landmarks.length === 0) return null;
  return (
    <p className={`text-sm ${muted}`}>
      <span aria-hidden="true">♪ </span>
      {landmarks.length > 1 ? 'Repères' : 'Repère'} : <LandmarkList landmarks={landmarks} />
    </p>
  );
}

/** Titres en italique, séparés par « · ». */
export function LandmarkList({ landmarks }: { landmarks: readonly string[] }) {
  return (
    <>
      {landmarks.map((landmark, index) => (
        <Fragment key={landmark}>
          {index > 0 && ' · '}
          <i>{landmark}</i>
        </Fragment>
      ))}
    </>
  );
}
