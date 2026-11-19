import type { Settings } from '../core/journal';
import type { IntervalPresentation } from '../core/exercise/rendition';
import { formatNote, INTERVALS, type IntervalCode, type NoteName } from '../core/theory';

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** « Tierce mineure », « Triton »… */
export function intervalName(code: IntervalCode): string {
  return capitalize(INTERVALS[code].name);
}

/** Titre d'une série : « Intervalles ascendants ». */
export function presentationTitle(presentation: IntervalPresentation): string {
  return {
    asc: 'Intervalles ascendants',
    desc: 'Intervalles descendants',
    harm: 'Intervalles harmoniques',
  }[presentation];
}

/** « Tierce mineure ascendante », « Triton descendant »… */
export function describeInterval(code: IntervalCode, presentation: IntervalPresentation): string {
  const masculine = code === 'TT';
  const qualifier = {
    asc: masculine ? 'ascendant' : 'ascendante',
    desc: masculine ? 'descendant' : 'descendante',
    harm: 'harmonique',
  }[presentation];
  return `${intervalName(code)} ${qualifier}`;
}

/** Notes selon les préférences : « Ré3 → Fa♯3 » (mélodique) ou « Ré3 + Fa♯3 » (harmonique). */
export function formatNotes(
  notes: readonly NoteName[],
  presentation: IntervalPresentation,
  settings: Pick<Settings, 'noteNames' | 'octaveConvention'>,
): string {
  return notes
    .map((note) =>
      formatNote(note, { naming: settings.noteNames, octave: settings.octaveConvention }),
    )
    .join(presentation === 'harm' ? ' + ' : ' → ');
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
}
