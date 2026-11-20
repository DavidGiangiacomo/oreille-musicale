import { Link } from 'react-router';
import { getStep, stepsOfTrack, TRACKS, type StepDef, type TrackDef } from '../../core/curriculum';
import type { StepState, StepStatus } from '../../core/progress/projection';
import { ProgressBar, ScreenHeader } from '../components/ScreenParts';
import {
  columnLabel,
  newItemsLabel,
  PHASE_LABELS,
  STATUS_LABELS,
  stepTitle,
} from '../progress/labels';
import { useProgress } from '../progress/useProgress';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted } from '../styles';

const CELL_STYLES: Record<StepStatus, string> = {
  validated:
    'bg-emerald-100 text-emerald-950 ring-emerald-400 dark:bg-emerald-950 dark:text-emerald-50',
  in_progress: 'bg-amber-100 text-amber-950 ring-amber-500 dark:bg-amber-950 dark:text-amber-50',
  available: 'bg-white ring-slate-400 dark:bg-slate-900',
  locked:
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:ring-slate-800',
};

const CELL_ICONS: Record<StepStatus, string> = {
  validated: '✓',
  in_progress: '●',
  available: '▶',
  locked: '🔒',
};

function StepCell({
  step,
  state,
  rowLabel,
}: {
  step: StepDef;
  state: StepState;
  rowLabel: string;
}) {
  const detail =
    state.status === 'in_progress' && state.phase
      ? PHASE_LABELS[state.phase]
      : STATUS_LABELS[state.status];
  const label = `${rowLabel}, étape ${step.column} (${newItemsLabel(step).toLowerCase()}) : ${detail.toLowerCase()}`;
  const className = `flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-xs ring-1 ${CELL_STYLES[state.status]}`;
  const content = (
    <>
      <span aria-hidden="true" className="text-base leading-none">
        {CELL_ICONS[state.status]}
      </span>
      <span aria-hidden="true" className="leading-tight">
        {detail}
      </span>
    </>
  );
  if (state.status === 'locked') {
    return (
      <span className={className} role="img" aria-label={label}>
        {content}
      </span>
    );
  }
  return (
    <Link
      to={`/etape/${step.id}`}
      aria-label={label}
      className={`${className} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500`}
    >
      {content}
    </Link>
  );
}

function TrackGrid({ track, states }: { track: TrackDef; states: Map<string, StepState> }) {
  const { settings, updateSettings } = useSettings();
  const steps = stepsOfTrack(track.id);
  const validated = steps.filter((step) => states.get(step.id)?.status === 'validated').length;
  const active = settings.activeTracks.includes(track.id);
  const onlyActive = active && settings.activeTracks.length === 1;
  // Prérequis dans d'autres parcours, tant qu'ils ne sont pas validés.
  const opensAfter = (track.unlockedBy ?? [])
    .map((id) => getStep(id))
    .filter((step): step is StepDef => step !== undefined)
    .filter((step) => states.get(step.id)?.status !== 'validated');

  return (
    <section className={card} aria-labelledby={`parcours-${track.id}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`parcours-${track.id}`} className={cardTitle}>
          {track.name}
        </h2>
        <span className={`${muted} text-sm tabular-nums`}>
          {validated} / {steps.length} étapes validées
        </span>
      </div>
      <ProgressBar label={`Progression : ${track.name}`} value={validated} max={steps.length} />
      {opensAfter.length > 0 && (
        <p className={`text-sm ${muted}`}>
          S'ouvre après{' '}
          {opensAfter.map((step) => stepTitle(step).replace(' · ', ', ')).join(' et ')}.
        </p>
      )}

      <table className="w-full table-fixed border-separate border-spacing-1.5">
        <caption className="sr-only">
          Étapes du parcours {track.name} : une ligne par étape, une colonne par présentation.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-[30%] text-left text-xs font-medium">
              Étape
            </th>
            {track.rows.map((row) => (
              <th
                key={row.presentation}
                scope="col"
                className="text-[11px] leading-tight font-medium hyphens-auto sm:text-xs"
              >
                {row.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {track.columns.map((_, index) => {
            const column = index + 1;
            const rowSteps = steps.filter((step) => step.column === column);
            const first = rowSteps[0];
            if (!first) return null;
            return (
              <tr key={column}>
                <th scope="row" className="text-left text-xs font-normal">
                  <span className="font-semibold">{column}</span>{' '}
                  <span className={muted}>{columnLabel(first)}</span>
                </th>
                {track.rows.map((row, rowIndex) => {
                  const step = rowSteps.find((candidate) => candidate.row === rowIndex);
                  const state = step ? states.get(step.id) : undefined;
                  return (
                    <td key={row.presentation}>
                      {step && state && <StepCell step={step} state={state} rowLabel={row.label} />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={`text-xs ${muted}`}>
        ✓ validée · ● en cours · ▶ à faire · 🔒 verrouillée.{' '}
        {track.rows.length > 1
          ? 'Une étape s’ouvre quand celle du dessus (élément précédent) et celle de gauche (présentation plus facile) sont validées.'
          : 'Chaque étape s’ouvre quand la précédente est validée.'}
      </p>
      <Link
        to={`/positionnement/${track.id}`}
        className="text-sm font-medium underline underline-offset-4"
      >
        Test de positionnement : valider d’emblée ce que tu sais déjà
      </Link>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-amber-500"
          checked={active}
          disabled={onlyActive}
          onChange={(event) =>
            updateSettings({
              activeTracks: event.target.checked
                ? [...settings.activeTracks, track.id]
                : settings.activeTracks.filter((id) => id !== track.id),
            })
          }
        />
        Proposer ce parcours dans la séance du jour
        {onlyActive && <span className={muted}>(au moins un parcours reste actif)</span>}
      </label>
    </section>
  );
}

export function CourseScreen() {
  const progress = useProgress();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <ScreenHeader backTo="/" backLabel="Accueil" title="Parcours" />
      {progress === undefined ? (
        <p className={muted}>Chargement…</p>
      ) : (
        TRACKS.map((track) => <TrackGrid key={track.id} track={track} states={progress.states} />)
      )}
    </main>
  );
}
