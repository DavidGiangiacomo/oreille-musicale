import { useMemo } from 'react';
import { Link } from 'react-router';
import { competenceId, parseCompetence } from '../../core/exercise/families';
import { activeTimeByDay, currentStreak } from '../../core/progress/activity';
import type { DailyPlan } from '../../core/session/daily';
import { daysUntilDue, GRADE_LABELS, projectReviews, studyDay } from '../../core/srs';
import { itemDescription } from '../items';
import { stepTitle } from '../progress/labels';
import { useJournalData } from '../progress/useJournalData';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted, primaryButton, secondaryButton } from '../styles';
import { DailyGoal } from './DailyGoal';
import { inDays, pairLabel } from './labels';

export interface BlockOutcome {
  answered: number;
  correct: number;
}

/** Compétences révisées, dans l'ordre des blocs puis des boutons. */
function reviewedIds(plan: DailyPlan): string[] {
  return plan.review.blocks.flatMap((block) =>
    block.focus.map((item) => competenceId(block.family, item, block.presentation)),
  );
}

const GRADE_STYLES: Record<number, string> = {
  1: 'text-red-700 dark:text-red-300',
  2: 'text-amber-700 dark:text-amber-300',
  3: 'text-emerald-700 dark:text-emerald-300',
  4: 'text-emerald-700 dark:text-emerald-300',
};

/** Bilan de la séance du jour : notes et prochaines échéances, objectif, série. */
export function DailySummary({
  plan,
  startedAt,
  outcomes,
}: {
  plan: DailyPlan;
  startedAt: number;
  outcomes: BlockOutcome[];
}) {
  const data = useJournalData();
  const { settings } = useSettings();
  const summary = useMemo(() => {
    if (!data) return null;
    const now = data.readAt;
    const reviews = projectReviews(data.events, data.attempts);
    const activity = activeTimeByDay(data.attempts);
    const goalMs = settings.dailyGoalMinutes * 60_000;
    return {
      reviewed: reviewedIds(plan).map((id) => {
        const state = reviews.get(id);
        const last = state?.history.at(-1);
        const graded = last && last.source === 'review' && last.at >= startedAt ? last : null;
        return { id, grade: graded?.grade ?? null, days: state ? daysUntilDue(state, now) : 0 };
      }),
      todayMs: activity.get(studyDay(now)) ?? 0,
      goalMs,
      streak: currentStreak(activity, goalMs, now),
    };
  }, [data, plan, startedAt, settings.dailyGoalMinutes]);

  const duels = plan.blocks
    .map((block, i) => ({ block, outcome: outcomes[i] }))
    .filter(({ block, outcome }) => block.kind === 'duel' && outcome);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-bold">Séance terminée</h1>
      {summary && (
        <DailyGoal todayMs={summary.todayMs} goalMs={summary.goalMs} streak={summary.streak} />
      )}

      {plan.review.dueIds.length > 0 && (
        <section className={card} aria-labelledby="bilan-revisions">
          <h2 id="bilan-revisions" className={cardTitle}>
            Révisions
          </h2>
          <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
            {summary?.reviewed.map(({ id, grade, days }) => {
              const parsed = parseCompetence(id);
              return (
                <li key={id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <span className="font-medium">
                    {parsed ? itemDescription(parsed.family, parsed.item, parsed.presentation) : id}
                  </span>
                  <span className="text-sm">
                    {grade === null ? (
                      <span className={muted}>pas assez de réponses</span>
                    ) : (
                      <>
                        <span className={`font-semibold ${GRADE_STYLES[grade]}`}>
                          {GRADE_LABELS[grade]}
                        </span>
                        <span className={muted}> · prochaine révision {inDays(days)}</span>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {plan.review.postponed > 0 && (
            <p className={`text-sm ${muted}`}>
              {plan.review.postponed} autre{plan.review.postponed > 1 ? 's' : ''} en retard, gardée
              {plan.review.postponed > 1 ? 's' : ''} pour la prochaine séance.
            </p>
          )}
        </section>
      )}

      {duels.length > 0 && (
        <section className={card} aria-labelledby="bilan-duels">
          <h2 id="bilan-duels" className={cardTitle}>
            Duels
          </h2>
          <ul className="flex flex-col gap-1">
            {duels.map(({ block, outcome }) => (
              <li key={block.context + block.choices.join()}>
                {pairLabel(block)} :{' '}
                <span className="font-semibold tabular-nums">
                  {outcome!.correct} / {outcome!.answered}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2">
        {plan.step && (
          <Link
            to={`/etape/${plan.step.id}`}
            className={`${primaryButton} flex items-center justify-center text-center`}
          >
            Continuer : {stepTitle(plan.step)}
          </Link>
        )}
        <Link
          to="/"
          className={`${plan.step ? secondaryButton : primaryButton} flex items-center justify-center`}
        >
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}
