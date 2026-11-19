import { useLiveQuery } from 'dexie-react-hooks';
import { getStep, getTrack } from '../../core/curriculum';
import type { SessionRecord } from '../../core/journal';
import { INTERVAL_CODES, INTERVALS, type IntervalCode } from '../../core/theory';
import { journal } from '../data';
import { presentationTitle } from '../format';
import { columnLabel } from '../progress/labels';
import { card, cardTitle, muted } from '../styles';

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

function itemsLabel(items: readonly string[]): string {
  if (items.length === INTERVAL_CODES.length) return 'les 12 intervalles';
  return items.map((item) => INTERVALS[item as IntervalCode]?.abbreviation ?? item).join(', ');
}

function title(session: SessionRecord): string {
  const step = session.stepId ? getStep(session.stepId) : undefined;
  if (step) {
    const row = getTrack(step.track).rows[step.row]?.label.toLowerCase() ?? '';
    return `Étape ${step.column} · ${row} (${columnLabel(step)})`;
  }
  if (!session.config) return 'Série';
  return `${presentationTitle(session.config.presentation)} · ${itemsLabel(session.config.items)}`;
}

/** Dernières séries, relues dans la base (elles survivent au rechargement de la page). */
export function HistoryList() {
  const summaries = useLiveQuery(() => journal.recentSessions(5), []);
  return (
    <section className={card} aria-labelledby="historique">
      <h2 id="historique" className={cardTitle}>
        Dernières séries
      </h2>
      {summaries === undefined ? null : summaries.length === 0 ? (
        <p className={muted}>Aucune série pour l'instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
          {summaries.map(({ session, correct, total }) => (
            <li key={session.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 flex-col">
                <span className="break-words">{title(session)}</span>
                <span className={`text-sm ${muted}`}>
                  {DATE_FORMAT.format(session.startedAt)}
                  {session.endedAt === undefined && session.kind === 'custom'
                    ? ' · interrompue'
                    : ''}
                </span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {correct} / {total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
