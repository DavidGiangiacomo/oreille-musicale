import type { Streak } from '../../core/progress/activity';
import { muted } from '../styles';
import { minutes } from './labels';

/** Anneau de l'objectif quotidien et série en cours (§9.4). */
export function DailyGoal({
  todayMs,
  goalMs,
  streak,
}: {
  todayMs: number;
  goalMs: number;
  streak: Streak;
}) {
  const ratio = goalMs === 0 ? 1 : Math.min(1, todayMs / goalMs);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const done = minutes(todayMs);
  const goal = minutes(goalMs);
  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 64 64"
        className="size-16 shrink-0 -rotate-90"
        role="img"
        aria-label={`Objectif du jour : ${done} minute${done > 1 ? 's' : ''} sur ${goal}`}
      >
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="8"
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        {ratio > 0 && (
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className={ratio >= 1 ? 'stroke-emerald-500' : 'stroke-amber-500'}
          />
        )}
      </svg>
      <div className="flex flex-col">
        <p className="font-semibold tabular-nums">
          {ratio >= 1 ? 'Objectif atteint ' : 'Aujourd’hui : '}
          {done} / {goal} min
        </p>
        <p className={`text-sm ${muted}`}>
          {streak.days === 0
            ? 'Atteins l’objectif pour commencer une série.'
            : `Série : ${streak.days} jour${streak.days > 1 ? 's' : ''}${streak.today ? '' : ' (continue-la aujourd’hui)'}`}
        </p>
      </div>
    </div>
  );
}
