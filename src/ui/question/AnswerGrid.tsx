import type { FamilyId } from '../../core/exercise/question';
import type { QuestionResult } from '../../core/session/series';
import { answerAccessibleName, answerLabel } from '../items';
import { keyHint } from './keys';

interface AnswerGridProps {
  family: FamilyId;
  choices: readonly string[];
  /** Bonne réponse et réponse donnée, pendant le feedback. */
  correctAnswer: string;
  result: QuestionResult | null;
  disabled: boolean;
  onAnswer: (answer: string) => void;
}

/** Boutons de réponse, dans l'ordre fixe de la famille, avec leur touche du clavier. */
export function AnswerGrid({
  family,
  choices,
  correctAnswer,
  result,
  disabled,
  onAnswer,
}: AnswerGridProps) {
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
        const isCorrect = result !== null && item === correctAnswer;
        const label = answerLabel(family, item);
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
            aria-label={answerAccessibleName(family, item)}
            aria-keyshortcuts={hint ?? undefined}
            className={`relative flex min-h-16 flex-col items-center justify-center rounded-xl border-2 px-2 py-2 transition-colors enabled:hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-default dark:enabled:hover:bg-slate-800 ${state} ${result !== null && !isCorrect && !isWrongChoice ? 'opacity-50' : ''}`}
          >
            <span className="text-xl font-bold">
              {isCorrect && <span aria-hidden="true">✓ </span>}
              {isWrongChoice && <span aria-hidden="true">✗ </span>}
              {label.short}
            </span>
            <span className="text-xs leading-tight">{label.name}</span>
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
