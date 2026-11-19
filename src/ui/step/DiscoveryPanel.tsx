import type { StepDef, StepPhase } from '../../core/curriculum';
import { sequenceEvents, type IntervalSound } from '../../core/exercise/intervalQuestion';
import type { Random } from '../../core/random';
import { comparisonExamples, discoveryExamples } from '../../core/session/step';
import { INTERVALS } from '../../core/theory';
import { audioEngine } from '../audio';
import { intervalName } from '../format';
import { PHASE_LABELS } from '../progress/labels';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted, primaryButton, secondaryButton } from '../styles';

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

  function play(sounds: IntervalSound[]) {
    onListen();
    audioEngine.play(sequenceEvents(sounds), { instrument: settings.instrument });
  }

  return (
    <section className={card} aria-labelledby="decouverte">
      <h2 id="decouverte" className={cardTitle}>
        Découverte
      </h2>
      <p className={muted}>
        Écoute {step.newItems.length > 1 ? 'chaque intervalle' : 'le nouvel intervalle'} sur
        plusieurs notes de départ, puis compare-le à ceux que tu connais. Rien n'est noté : passe à
        la suite quand tu veux.
      </p>
      {step.newItems.map((item) => (
        <div key={item} className="flex flex-col gap-2">
          <h3 className="font-semibold">
            {intervalName(item)} ({INTERVALS[item].abbreviation})
          </h3>
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
              <span aria-hidden="true">▶ </span>Comparer avec {intervalName(neighbor).toLowerCase()}{' '}
              ({INTERVALS[neighbor].abbreviation})
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
          <span aria-hidden="true">▶ </span>Les comparer depuis la même note
        </button>
      )}
      <button type="button" className={primaryButton} onClick={onContinue}>
        Continuer : {PHASE_LABELS[nextPhase].toLowerCase()}
      </button>
    </section>
  );
}
