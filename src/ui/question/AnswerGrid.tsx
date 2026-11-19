import type { QuestionResult } from '../../core/session/series';
import { INTERVALS, type IntervalCode } from '../../core/theory';
import { intervalName } from '../format';
import { keyHint } from './keys';

interface AnswerGridProps {
  choices: readonly IntervalCode[];
  /** Bonne réponse et réponse donnée, pendant le feedback. */
  correctItem: IntervalCode;
  result: QuestionResult | null;
  disabled: boolean;
  onAnswer: (item: IntervalCode) => void;
}

/** Boutons de réponse, dans l'ordre fixe des intervalles, avec leur touche du clavier. */
export function AnswerGrid({ choices, correctItem, result, disabled, onAnswer }: AnswerGridProps) {
  return (
    <div
      className={`grid gap-2 ${
        choices.length === 3
          ? 'grid-cols-3'
          : choices.length <= 4
            ? 'grid-cols-2'
            : 'grid-cols-3 sm:grid-cols-4'
      }`}
      role="group"
      aria-label="Réponses"
    >
      {choices.map((item, index) => {
        const hint = keyHint(index);
        const isCorrect = result !== null && item === correctItem;
        const isWrongChoice = result !== null && !result.correct && item === result.answer;
        const state = isCorrect
          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50'
          : isWrongChoice
            ? 'border-red-500 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50'
            : 'border-slate-300 dark:border-slate-700';
        return (
          <button
            key={item}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(item)}
            aria-label={`${intervalName(item)} (${INTERVALS[item].abbreviation})`}
            aria-keyshortcuts={hint ?? undefined}
            className={`relative flex min-h-16 flex-col items-center justify-center rounded-xl border-2 px-2 py-2 transition-colors enabled:hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-default dark:enabled:hover:bg-slate-800 ${state} ${result !== null && !isCorrect && !isWrongChoice ? 'opacity-50' : ''}`}
          >
            <span className="text-xl font-bold">
              {isCorrect && <span aria-hidden="true">✓ </span>}
              {isWrongChoice && <span aria-hidden="true">✗ </span>}
              {INTERVALS[item].abbreviation}
            </span>
            <span className="text-xs leading-tight">{intervalName(item)}</span>
            {hint && (
              <kbd className="absolute top-1 right-1.5 font-sans text-[10px] text-slate-400">
                {hint}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}
