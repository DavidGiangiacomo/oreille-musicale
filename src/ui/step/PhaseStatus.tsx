import type { StepDef } from '../../core/curriculum';
import {
  READINESS,
  trainingDifficulty,
  trainingReadiness,
  type StepResult,
} from '../../core/session/step';
import { intervalName } from '../format';
import { muted, primaryButton, secondaryButton } from '../styles';

const percent = (value: number) => `${Math.round(value * 100)} %`;

/** Comparaison : objectif de 8 bonnes réponses sur les 10 dernières. */
export function ContrastStatus({ results }: { results: readonly StepResult[] }) {
  const recent = results.slice(-10).filter((result) => result.correct).length;
  return (
    <p className={`text-sm ${muted}`}>
      Comparaison : {recent} bonne{recent > 1 ? 's' : ''} réponse{recent > 1 ? 's' : ''} sur les 10
      dernières (objectif : 8).
    </p>
  );
}

/** Entraînement : où en est-on avant le test (§7.3), et ajustement de la difficulté (§7.5). */
export function TrainingStatus({
  step,
  results,
  onTakeTest,
}: {
  step: StepDef;
  results: readonly StepResult[];
  onTakeTest: () => void;
}) {
  const readiness = trainingReadiness(step, results);
  const difficulty = trainingDifficulty(results);
  const remaining = READINESS.window - results.length;
  return (
    <section
      aria-label="Avant le test"
      className={`flex flex-col gap-2 rounded-2xl p-4 text-sm ring-1 ${
        readiness.ready
          ? 'bg-emerald-50 ring-emerald-400 dark:bg-emerald-950/40'
          : 'ring-slate-200 dark:ring-slate-800'
      }`}
    >
      {readiness.ready ? (
        <p className="text-base font-semibold">Tu es prêt pour le test !</p>
      ) : readiness.recentAccuracy === null ? (
        <p>
          Encore {remaining} réponse{remaining > 1 ? 's' : ''} avant de mesurer ta réussite
          (objectif : {percent(READINESS.minAccuracy)} sur les {READINESS.window} dernières).
        </p>
      ) : (
        <p>
          Réussite sur les {READINESS.window} dernières réponses :{' '}
          <strong>{percent(readiness.recentAccuracy)}</strong> (objectif :{' '}
          {percent(READINESS.minAccuracy)}).
        </p>
      )}
      <ul className={muted}>
        {step.newItems.map((item) => (
          <li key={item}>
            {intervalName(item)} : entendu{' '}
            {Math.min(readiness.newItemCounts[item] ?? 0, READINESS.minNewItemCount)} /{' '}
            {READINESS.minNewItemCount} fois
          </li>
        ))}
      </ul>
      {difficulty !== 'normal' && (
        <p className={muted}>
          {difficulty === 'easier'
            ? 'Questions facilitées : tempo lent et registre resserré, le temps de retrouver tes repères.'
            : 'Questions corsées : registre élargi et tempo rapide, puisque tout va bien.'}
        </p>
      )}
      <button
        type="button"
        className={readiness.ready ? primaryButton : secondaryButton}
        onClick={onTakeTest}
      >
        {readiness.ready ? 'Passer le test' : 'Je connais déjà : passer le test'}
      </button>
    </section>
  );
}
