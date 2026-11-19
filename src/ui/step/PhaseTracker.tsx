import type { StepPhase } from '../../core/curriculum';
import { PHASE_LABELS } from '../progress/labels';

/** Étapes de la phase en cours : Découverte · Comparaison · Entraînement · Test. */
export function PhaseTracker({
  phases,
  current,
}: {
  phases: StepPhase[];
  current: StepPhase | null;
}) {
  const currentIndex = current === null ? -1 : phases.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-x-2 gap-y-1 text-sm" aria-label="Phases de l’étape">
      {phases.map((phase, i) => (
        <li
          key={phase}
          aria-current={phase === current ? 'step' : undefined}
          className={`rounded-full px-2.5 py-0.5 ${
            phase === current
              ? 'bg-amber-500 font-semibold text-slate-950'
              : i < currentIndex
                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                : 'text-slate-500 ring-1 ring-slate-300 dark:ring-slate-700'
          }`}
        >
          {i < currentIndex && <span aria-hidden="true">✓ </span>}
          {PHASE_LABELS[phase]}
        </li>
      ))}
    </ol>
  );
}
