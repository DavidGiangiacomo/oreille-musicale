import { useMemo, useState } from 'react';
import { STEPS, TRACKS } from '../../core/curriculum';
import { parseCompetence } from '../../core/exercise/families';
import type { FamilyId } from '../../core/exercise/question';
import type { Presentation } from '../../core/exercise/rendition';
import { activeTimeByDay, currentStreak } from '../../core/progress/activity';
import { projectCompetences, projectSteps } from '../../core/progress/projection';
import {
  activityCalendar,
  competenceHistory,
  confusionTables,
  masteryGrid,
  practicedCompetences,
  reviewCalibration,
  topConfusions,
  type CalendarDay,
  type ConfusionTable,
} from '../../core/progress/stats';
import { projectReviews, studyDay, TARGET_RETENTION } from '../../core/srs';
import { ScreenHeader } from '../components/ScreenParts';
import { answerLabel, contextTitle, itemDescription, itemShort } from '../items';
import { useJournalData } from '../progress/useJournalData';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted } from '../styles';
import { LineChart, Readout, StatTile, TableView } from './charts';
import { heatStep, heatStyle, masteryStyle } from './colors';

const MASTERY_NAMES = ['Non vue', 'En apprentissage', 'Acquise', 'Consolidée', 'Maîtrisée'];
const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const LONG_DAY = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const dateOf = (day: string) => new Date(`${day}T12:00:00`);

/** Case du calendrier : 1 à 4 selon la part de l'objectif, 5 quand il est atteint. */
function calendarStep(activeMs: number, goalMs: number): number {
  if (activeMs >= goalMs) return 5;
  return Math.min(4, heatStep(activeMs, goalMs));
}
const minutes = (ms: number) => Math.round(ms / 60_000);

function durationLabel(ms: number): string {
  const total = minutes(ms);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`;
}

/** Statistiques (§9.1) : activité, révisions, maîtrise, confusions, progrès. */
export function StatsScreen() {
  const data = useJournalData();
  const { settings } = useSettings();
  const stats = useMemo(() => {
    if (!data) return null;
    const now = data.readAt;
    const stepStates = projectSteps(STEPS, data.events);
    const reviews = projectReviews(data.events, data.attempts);
    const competences = projectCompetences(STEPS, stepStates, data.events, data.attempts, reviews);
    const activity = activeTimeByDay(data.attempts);
    const goalMs = settings.dailyGoalMinutes * 60_000;
    const today = studyDay(now);
    const week = [...activity].filter(([day]) => day > studyDay(now - 7 * 86_400_000));
    const tables = confusionTables(data.attempts, now);
    return {
      goalMs,
      todayMs: activity.get(today) ?? 0,
      weekMs: week.reduce((sum, [, ms]) => sum + ms, 0),
      totalMs: [...activity.values()].reduce((sum, ms) => sum + ms, 0),
      streak: currentStreak(activity, goalMs, now),
      calendar: activityCalendar(activity, now),
      calibration: reviewCalibration(reviews, now),
      grids: TRACKS.map((track) => ({ track, rows: masteryGrid(track, STEPS, competences) })),
      tables,
      top: topConfusions(tables),
      practiced: practicedCompetences(data.attempts),
      attempts: data.attempts,
    };
  }, [data, settings.dailyGoalMinutes]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <ScreenHeader backTo="/" backLabel="Accueil" title="Statistiques" />
      {!stats ? (
        <p className={muted}>Chargement…</p>
      ) : stats.attempts.length === 0 ? (
        <p className={muted}>
          Pas encore de réponses : les statistiques apparaîtront après ta première séance.
        </p>
      ) : (
        <>
          <ActivitySection {...stats} />
          <ReviewSection calibration={stats.calibration} />
          <MasterySection grids={stats.grids} />
          <ConfusionSection tables={stats.tables} top={stats.top} />
          <ProgressSection practiced={stats.practiced} attempts={stats.attempts} />
        </>
      )}
    </main>
  );
}

function ActivitySection({
  todayMs,
  weekMs,
  totalMs,
  goalMs,
  streak,
  calendar,
}: {
  todayMs: number;
  weekMs: number;
  totalMs: number;
  goalMs: number;
  streak: { days: number; today: boolean };
  calendar: CalendarDay[][];
}) {
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const days = calendar.flat();
  const describe = (day: CalendarDay) =>
    `${LONG_DAY.format(dateOf(day.day))} : ${day.activeMs > 0 ? durationLabel(day.activeMs) : 'pas de pratique'}${day.activeMs >= goalMs ? ', objectif atteint' : ''}`;
  return (
    <section className={card} aria-labelledby="activite">
      <h2 id="activite" className={cardTitle}>
        Activité
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Série" value={`${streak.days} jour${streak.days > 1 ? 's' : ''}`} />
        <StatTile
          label="Aujourd’hui"
          value={`${minutes(todayMs)} min`}
          hint={`objectif ${minutes(goalMs)} min`}
        />
        <StatTile label="7 derniers jours" value={durationLabel(weekMs)} />
        <StatTile label="En tout" value={durationLabel(totalMs)} />
      </div>
      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-medium">Pratique des 12 dernières semaines</figcaption>
        <Readout>
          {selected ? (
            describe(selected)
          ) : (
            <span className={muted}>Touche une case pour lire le jour.</span>
          )}
        </Readout>
        <div
          className="flex gap-1"
          role="group"
          aria-label="Calendrier d’activité, une colonne par semaine"
        >
          {calendar.map((week, w) => (
            <div key={w} className="flex flex-col gap-1">
              {week.map((day) => (
                <button
                  key={day.day}
                  type="button"
                  aria-label={describe(day)}
                  onPointerEnter={() => setSelected(day)}
                  onFocus={() => setSelected(day)}
                  onClick={() => setSelected(day)}
                  className="size-5 rounded-[4px] focus-visible:outline-2 focus-visible:outline-amber-500 sm:size-6"
                  style={heatStyle(calendarStep(day.activeMs, goalMs))}
                >
                  {day.activeMs >= goalMs && (
                    <span aria-hidden="true" className="text-[10px] leading-none">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className={`flex items-center gap-1 text-xs ${muted}`} aria-hidden="true">
          Moins
          {[0, 1, 2, 3, 4].map((step) => (
            <span key={step} className="size-3 rounded-[3px]" style={heatStyle(step)} />
          ))}
          plus ·{' '}
          <span
            className="inline-flex size-3 items-center justify-center rounded-[3px] text-[8px]"
            style={heatStyle(5)}
          >
            ✓
          </span>{' '}
          objectif atteint
        </div>
        <TableView
          caption="Pratique par jour"
          headers={['Jour', 'Pratique', 'Objectif']}
          rows={days
            .filter((day) => day.activeMs > 0)
            .reverse()
            .map((day) => [
              DAY_FORMAT.format(dateOf(day.day)),
              durationLabel(day.activeMs),
              day.activeMs >= goalMs ? 'atteint' : '—',
            ])}
        />
      </figure>
    </section>
  );
}

function ReviewSection({ calibration }: { calibration: { count: number; passed: number } }) {
  const { count, passed } = calibration;
  const rate = count === 0 ? 0 : passed / count;
  const target = Math.round(TARGET_RETENTION * 100);
  return (
    <section className={card} aria-labelledby="revisions">
      <h2 id="revisions" className={cardTitle}>
        Révisions réussies
      </h2>
      {count < 10 ? (
        <p className={muted}>
          {count === 0 ? 'Aucune révision' : `${count} révision${count > 1 ? 's' : ''}`} ces 30
          derniers jours : il en faut une dizaine pour juger.
        </p>
      ) : (
        <>
          <p>
            <strong className="text-2xl">{Math.round(rate * 100)} %</strong>{' '}
            <span className={muted}>
              des {count} révisions des 30 derniers jours (FSRS vise {target} %)
            </span>
          </p>
          <div
            role="meter"
            aria-label="Révisions réussies"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(rate * 100)}
            className="relative h-2 rounded-full"
            style={{ background: 'var(--heat-1)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${rate * 100}%`, background: 'var(--heat-4)' }}
            />
            <div
              aria-hidden="true"
              className="absolute -top-1 h-4 w-0.5 bg-slate-500"
              style={{ left: `${target}%` }}
            />
          </div>
          <p className={`text-sm ${muted}`}>
            {rate < TARGET_RETENTION - 0.05
              ? 'Un peu en dessous : les révisions viennent peut-être trop tard pour toi.'
              : rate > TARGET_RETENTION + 0.05
                ? 'Au-dessus de l’objectif : tes révisions pourraient être plus espacées.'
                : 'Conforme à l’objectif : l’espacement des révisions te convient.'}
          </p>
        </>
      )}
    </section>
  );
}

function MasterySection({
  grids,
}: {
  grids: { track: (typeof TRACKS)[number]; rows: ReturnType<typeof masteryGrid> }[];
}) {
  const started = grids.filter(({ rows }) =>
    rows.some((row) => row.cells.some((cell) => cell && cell.level > 0)),
  );
  const notStarted = grids.filter((grid) => !started.includes(grid)).map(({ track }) => track.name);
  return (
    <section className={card} aria-labelledby="maitrise">
      <h2 id="maitrise" className={cardTitle}>
        Maîtrise
      </h2>
      <div className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${muted}`}>
        {MASTERY_NAMES.map((name, level) => (
          <span key={name} className="inline-flex items-center gap-1">
            <span
              className="inline-flex size-4 items-center justify-center rounded-[4px] text-[10px] font-semibold"
              style={masteryStyle(level)}
            >
              {level > 0 ? level : ''}
            </span>
            {name}
          </span>
        ))}
        <span>! fragile</span>
      </div>
      {started.map(({ track, rows }) => (
        <table
          key={track.id}
          className="w-full table-fixed border-separate border-spacing-1 text-sm"
        >
          <caption className="text-left font-semibold">{track.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-1/4 text-left text-xs font-medium">
                <span className="sr-only">Élément</span>
              </th>
              {track.rows.map((row) => (
                <th key={row.presentation} scope="col" className="text-xs font-medium">
                  {row.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.item}>
                <th scope="row" className="text-left text-xs font-normal">
                  {itemShort(track.family, row.item)}
                </th>
                {row.cells.map((cell, i) => {
                  const presentation = track.rows[i]?.presentation as Presentation;
                  if (!cell) return <td key={i} />;
                  const label = `${itemDescription(track.family, row.item, presentation)} : ${MASTERY_NAMES[cell.level]?.toLowerCase()}${cell.fragile ? ', fragile' : ''}`;
                  return (
                    <td key={i}>
                      <span
                        role="img"
                        aria-label={label}
                        title={label}
                        className="flex h-6 items-center justify-center rounded-[4px] text-xs font-semibold"
                        style={masteryStyle(cell.level)}
                      >
                        {cell.level > 0 ? cell.level : ''}
                        {cell.fragile ? ' !' : ''}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      {notStarted.length > 0 && (
        <p className={`text-sm ${muted}`}>Pas encore commencés : {notStarted.join(', ')}.</p>
      )}
    </section>
  );
}

function ConfusionSection({
  tables,
  top,
}: {
  tables: ConfusionTable[];
  top: ReturnType<typeof topConfusions>;
}) {
  const [context, setContext] = useState(tables[0]?.context ?? '');
  const [selected, setSelected] = useState<string | null>(null);
  const table = tables.find((candidate) => candidate.context === context) ?? tables[0];
  const familyOf = (ctx: string) => ctx.split(':')[0] as FamilyId;
  const titleOf = (ctx: string) => contextTitle(familyOf(ctx), ctx.split(':')[1] as Presentation);
  const short = (ctx: string, answer: string) => answerLabel(familyOf(ctx), answer).short;

  return (
    <section className={card} aria-labelledby="confusions">
      <h2 id="confusions" className={cardTitle}>
        Confusions
      </h2>
      {top.length === 0 ? (
        <p className={muted}>Aucune erreur ces 60 derniers jours.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {top.map(({ context: ctx, pair, errors }) => (
            <li key={`${ctx}-${pair.join()}`}>
              Tu confonds {short(ctx, pair[0])} et {short(ctx, pair[1])}{' '}
              <span className={muted}>
                ({titleOf(ctx).toLowerCase()}, {errors} erreur{errors > 1 ? 's' : ''})
              </span>
            </li>
          ))}
        </ul>
      )}
      {table && (
        <figure className="flex flex-col gap-2">
          {tables.length > 1 && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Contexte
              <select
                value={table.context}
                onChange={(event) => {
                  setContext(event.target.value);
                  setSelected(null);
                }}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900"
              >
                {tables.map((t) => (
                  <option key={t.context} value={t.context}>
                    {titleOf(t.context)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <figcaption className="text-sm font-medium">
            Réponses données (colonnes) pour chaque élément joué (lignes), 60 derniers jours
          </figcaption>
          <Readout>
            {selected ?? <span className={muted}>Touche une case pour la lire.</span>}
          </Readout>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0.5 text-xs tabular-nums">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Joué</span>
                  </th>
                  {table.answers.map((answer) => (
                    <th key={answer} scope="col" className="min-w-7 px-0.5 font-medium">
                      {short(table.context, answer)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.answers.map((played, i) => (
                  <tr key={played}>
                    <th scope="row" className="pr-1 text-right font-medium">
                      {short(table.context, played)}
                    </th>
                    {table.answers.map((answered, j) => {
                      const count = table.counts[i]?.[j] ?? 0;
                      const diagonal = i === j;
                      const text = diagonal
                        ? `${short(table.context, played)} reconnu ${count} fois`
                        : `${short(table.context, played)} pris pour ${short(table.context, answered)} : ${count} fois`;
                      return (
                        <td key={answered} className="p-0">
                          <button
                            type="button"
                            aria-label={text}
                            onPointerEnter={() => setSelected(text)}
                            onFocus={() => setSelected(text)}
                            onClick={() => setSelected(text)}
                            className="flex size-7 items-center justify-center rounded-[4px] focus-visible:outline-2 focus-visible:outline-amber-500"
                            style={
                              diagonal
                                ? {
                                    background: 'var(--chart-empty)',
                                    color: 'var(--chart-empty-ink)',
                                  }
                                : heatStyle(heatStep(count, table.maxErrors))
                            }
                          >
                            {count > 0 ? count : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`text-xs ${muted}`}>
            Diagonale en gris : bonnes réponses. Hors diagonale, plus la case est foncée, plus la
            confusion est fréquente.
          </p>
        </figure>
      )}
    </section>
  );
}

function ProgressSection({
  practiced,
  attempts,
}: {
  practiced: string[];
  attempts: Parameters<typeof competenceHistory>[0];
}) {
  const [id, setId] = useState(practiced[0] ?? '');
  const history = useMemo(() => competenceHistory(attempts, id), [attempts, id]);
  const describe = (competence: string) => {
    const parsed = parseCompetence(competence);
    return parsed ? itemDescription(parsed.family, parsed.item, parsed.presentation) : competence;
  };
  const accuracy = history.map((point) => ({
    label: DAY_FORMAT.format(dateOf(point.day)),
    value: point.correct / point.answered,
  }));
  const times = history
    .filter((point) => point.medianCorrectMs !== null)
    .map((point) => ({
      label: DAY_FORMAT.format(dateOf(point.day)),
      value: (point.medianCorrectMs as number) / 1000,
    }));
  const maxTime = Math.max(2, Math.ceil(Math.max(0, ...times.map((t) => t.value))));

  return (
    <section className={card} aria-labelledby="progres">
      <h2 id="progres" className={cardTitle}>
        Progrès par compétence
      </h2>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Compétence
        <select
          value={id}
          onChange={(event) => setId(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900"
        >
          {practiced.map((competence) => (
            <option key={competence} value={competence}>
              {describe(competence)}
            </option>
          ))}
        </select>
      </label>
      <LineChart
        key={`${id}-reussite`}
        title="Réussite par jour"
        points={accuracy}
        max={1}
        ticks={[0, 0.5, 1]}
        format={(value) => `${Math.round(value * 100)} %`}
      />
      {times.length > 0 && (
        <LineChart
          key={`${id}-temps`}
          title="Temps de réponse médian (bonnes réponses)"
          points={times}
          max={maxTime}
          ticks={[0, maxTime / 2, maxTime]}
          format={(value) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`}
        />
      )}
      <TableView
        caption={`Progrès : ${describe(id)}`}
        headers={['Jour', 'Réponses', 'Réussite', 'Temps médian']}
        rows={history.map((point) => [
          DAY_FORMAT.format(dateOf(point.day)),
          point.answered,
          `${Math.round((point.correct / point.answered) * 100)} %`,
          point.medianCorrectMs === null
            ? '—'
            : `${(point.medianCorrectMs / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`,
        ])}
      />
    </section>
  );
}
