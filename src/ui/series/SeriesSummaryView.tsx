import { Link } from 'react-router';
import { seriesSummary, type SeriesState } from '../../core/session/series';
import { INTERVALS } from '../../core/theory';
import { formatSeconds, intervalName, presentationTitle } from '../format';
import { card, cardTitle, muted, primaryButton, secondaryButton } from '../styles';

function encouragement(ratio: number): string {
  if (ratio >= 0.9) return 'Excellent !';
  if (ratio >= 0.7) return 'Bien joué !';
  if (ratio >= 0.5) return 'Ça progresse.';
  return 'Continue : c’est en répétant que l’oreille se forme.';
}

export function SeriesSummaryView({
  state,
  onRestart,
}: {
  state: SeriesState;
  onRestart: () => void;
}) {
  const summary = seriesSummary(state);
  const ratio = summary.total === 0 ? 0 : summary.correct / summary.total;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className={muted}>{presentationTitle(state.config.presentation)}</p>
        <h1 className="text-3xl font-bold">Série terminée</h1>
      </header>

      <section className={card} aria-labelledby="score">
        <p id="score" className="text-5xl font-bold">
          {summary.correct} / {summary.total}
        </p>
        <p className="text-lg">{encouragement(ratio)}</p>
        {summary.medianResponseTimeMs !== null && (
          <p className={muted}>
            Temps de réponse médian : {formatSeconds(summary.medianResponseTimeMs)}
          </p>
        )}
      </section>

      <section className={card}>
        <h2 className={cardTitle}>Par intervalle</h2>
        <ul className="flex flex-col gap-3">
          {summary.byItem.map(({ item, correct, total }) => (
            <li key={item} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2">
                <span>
                  {intervalName(item)}{' '}
                  <span className={muted}>({INTERVALS[item].abbreviation})</span>
                </span>
                <span className="font-semibold tabular-nums">
                  {correct} / {total}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${(correct / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={primaryButton} onClick={onRestart}>
          Recommencer
        </button>
        <Link to="/" className={`${secondaryButton} flex items-center justify-center`}>
          Accueil
        </Link>
      </div>
    </main>
  );
}
