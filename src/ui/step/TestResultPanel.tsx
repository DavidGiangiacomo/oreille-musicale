import type { StepDef } from '../../core/curriculum';
import type { TestEvaluation } from '../../core/session/step';
import { intervalName } from '../format';
import { card, muted, primaryButton, secondaryButton } from '../styles';

const percent = (value: number) => `${Math.round(value * 100)} %`;

export function TestResultPanel({
  step,
  evaluation,
  onNext,
  nextLabel,
  onTrain,
  onRetest,
}: {
  step: StepDef;
  evaluation: TestEvaluation;
  onNext: () => void;
  nextLabel: string;
  onTrain: () => void;
  onRetest: () => void;
}) {
  return (
    <section
      className={`${card} ring-2 ${evaluation.passed ? 'ring-emerald-500' : 'ring-amber-500'}`}
      aria-labelledby="resultat"
    >
      <h2 id="resultat" className="text-2xl font-bold">
        {evaluation.passed ? (
          <>
            <span aria-hidden="true">✓ </span>Étape validée !
          </>
        ) : (
          'Pas encore validée'
        )}
      </h2>
      <p className="text-lg">
        Réussite : <strong>{percent(evaluation.accuracy)}</strong>
        {!evaluation.passed && ` (il faut ${percent(step.validation.minAccuracy)})`}
      </p>
      <ul className={muted}>
        {step.newItems.map((item) => (
          <li key={item}>
            {intervalName(item)} : {percent(evaluation.newItemAccuracy[item] ?? 0)}
            {!evaluation.passed && ` (il faut ${percent(step.validation.minNewItemAccuracy)})`}
          </li>
        ))}
      </ul>
      {evaluation.passed ? (
        <>
          <p className={muted}>Les étapes suivantes du parcours sont débloquées.</p>
          <button type="button" className={primaryButton} onClick={onNext}>
            {nextLabel}
          </button>
        </>
      ) : (
        <>
          <p className={muted}>
            Un peu d'entraînement, en insistant sur ce qui t'a échappé, et tu pourras le repasser.
          </p>
          <button type="button" className={primaryButton} onClick={onTrain}>
            Reprendre l'entraînement
          </button>
          <button type="button" className={secondaryButton} onClick={onRetest}>
            Repasser le test
          </button>
        </>
      )}
    </section>
  );
}
