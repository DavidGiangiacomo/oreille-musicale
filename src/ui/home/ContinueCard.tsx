import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { prepareAudio } from '../audio';
import { PHASE_LABELS, stepSubtitle, stepTitle } from '../progress/labels';
import { useProgress } from '../progress/useProgress';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted, primaryButton } from '../styles';

/** Accès direct à l'étape à travailler (§9.1). */
export function ContinueCard() {
  const progress = useProgress();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (progress === undefined) return null;
  const step = progress.current;

  async function start(stepId: string) {
    setError(null);
    try {
      setLoading(0);
      await prepareAudio(settings.instrument, setLoading);
      void navigate(`/etape/${stepId}`);
    } catch {
      setError('Le son n’a pas pu démarrer. Vérifie ta connexion et réessaie.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className={card} aria-labelledby="continuer">
      <h2 id="continuer" className={cardTitle}>
        Parcours
      </h2>
      {step ? (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">{stepTitle(step)}</p>
            <p>{stepSubtitle(step)}</p>
            <p className={`text-sm ${muted}`}>
              {progress.states.get(step.id)?.phase
                ? `Phase en cours : ${PHASE_LABELS[progress.states.get(step.id)!.phase!].toLowerCase()}`
                : 'Nouvelle étape'}
            </p>
          </div>
          <button
            type="button"
            className={primaryButton}
            onClick={() => void start(step.id)}
            disabled={loading !== null}
          >
            Continuer
          </button>
          {loading !== null && (
            <p role="status" className={muted}>
              Chargement du piano… {Math.round(loading * 100)} %
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
        </>
      ) : (
        <p className="text-lg font-semibold">Toutes les étapes sont validées. Bravo !</p>
      )}
      <Link to="/parcours" className="text-center font-medium underline underline-offset-4">
        Voir tout le parcours
      </Link>
    </section>
  );
}
