import type { StepDef, StepPhase } from '../../core/curriculum';
import type { FamilyId } from '../../core/exercise/question';
import { sequenceEvents } from '../../core/exercise/intervalQuestion';
import type { Sound } from '../../core/exercise/question';
import type { Random } from '../../core/random';
import { comparisonExamples, discoveryExamples } from '../../core/session/step';
import { audioEngine } from '../audio';
import { itemLabel } from '../items';
import type { IntervalCode } from '../../core/theory';
import { Landmark } from '../question/Landmark';
import { PHASE_LABELS } from '../progress/labels';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted, primaryButton, secondaryButton } from '../styles';

const INTRODUCTIONS: Record<FamilyId, (several: boolean) => string> = {
  int: (several) =>
    `Écoute ${several ? 'chaque intervalle' : 'le nouvel intervalle'} sur plusieurs notes de départ, puis compare-le à ceux que tu connais. Rien n'est noté : passe à la suite quand tu veux.`,
  chd: (several) =>
    `Écoute ${several ? 'chaque accord' : 'le nouvel accord'} sur plusieurs fondamentales, puis compare-le à ceux que tu connais. Rien n'est noté : passe à la suite quand tu veux.`,
  scl: (several) =>
    `Écoute ${several ? 'chaque gamme' : 'la nouvelle gamme'} sur plusieurs toniques, puis compare-la à celles que tu connais : même tonique, une ou deux notes changent. Rien n'est noté : passe à la suite quand tu veux.`,
  mod: (several) =>
    `Écoute ${several ? 'chaque mode' : 'le nouveau mode'} sur plusieurs toniques. Un mode s'entend par rapport à sa tonique : repère la note caractéristique qui le distingue du mode de référence. Rien n'est noté : passe à la suite quand tu veux.`,
  inv: (several) =>
    `Écoute ${several ? 'chaque renversement' : 'le nouveau renversement'} : c'est la note la plus grave, la basse, qui change. Rien n'est noté : passe à la suite quand tu veux.`,
};

const COMPARE_LABELS: Record<FamilyId, string> = {
  int: 'Les comparer depuis la même note',
  chd: 'Les comparer sur la même fondamentale',
  inv: 'Les comparer sur la même fondamentale',
  scl: 'Les comparer sur la même tonique',
  mod: 'Les comparer sur la même tonique',
};

/** Phase de découverte (§7.3) : écoutes libres, rien n'est noté. */
export function DiscoveryPanel({
  step,
  random,
  nextPhase,
  onListen,
  onContinue,
}: {
  step: StepDef;
  random: Random;
  nextPhase: StepPhase;
  onListen: () => void;
  onContinue: () => void;
}) {
  const { settings } = useSettings();

  function play(sounds: Sound[]) {
    onListen();
    audioEngine.play(sequenceEvents(sounds), { instrument: settings.instrument });
  }

  return (
    <section className={card} aria-labelledby="decouverte">
      <h2 id="decouverte" className={cardTitle}>
        Découverte
      </h2>
      <p className={muted}>{INTRODUCTIONS[step.family](step.newItems.length > 1)}</p>
      {step.newItems.map((item) => (
        <div key={item} className="flex flex-col gap-2">
          <h3 className="font-semibold">{itemLabel(step.family, item)}</h3>
          {step.family === 'int' && settings.showLandmarks && (
            <Landmark code={item as IntervalCode} presentation={step.presentation} />
          )}
          <button
            type="button"
            className={secondaryButton}
            onClick={() => play(discoveryExamples(step, item, random))}
          >
            <span aria-hidden="true">▶ </span>Écouter 4 exemples
          </button>
          {(step.contrast[item] ?? []).map((neighbor) => (
            <button
              key={neighbor}
              type="button"
              className={secondaryButton}
              onClick={() => play(comparisonExamples(step, [item, neighbor], random))}
            >
              <span aria-hidden="true">▶ </span>Comparer avec{' '}
              {itemLabel(step.family, neighbor).replace(/^./, (c) => c.toLowerCase())}
            </button>
          ))}
        </div>
      ))}
      {step.newItems.length > 1 && (
        <button
          type="button"
          className={secondaryButton}
          onClick={() => play(comparisonExamples(step, step.newItems, random))}
        >
          <span aria-hidden="true">▶ </span>
          {COMPARE_LABELS[step.family]}
        </button>
      )}
      <button type="button" className={primaryButton} onClick={onContinue}>
        Continuer : {PHASE_LABELS[nextPhase].toLowerCase()}
      </button>
    </section>
  );
}
