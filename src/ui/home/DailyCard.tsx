import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DAILY } from '../../core/session/daily';
import { REVIEW } from '../../core/session/review';
import { loadingLabel, prepareAudio } from '../audio';
import { DailyGoal } from '../daily/DailyGoal';
import { inDays } from '../daily/labels';
import { stepTitle } from '../progress/labels';
import { useDailyStatus } from '../progress/useJournalData';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted, primaryButton } from '../styles';

/** Un seul bouton pour la séance du jour (§9.4) : l'appli décide quoi travailler. */
export function DailyCard() {
  const status = useDailyStatus();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === undefined) return null;
  const { dueCount, duelCount, current, nextDueInDays } = status;
  const nothingToDo = dueCount === 0 && duelCount === 0 && current === null;

  async function start() {
    setError(null);
    try {
      setLoading(0);
      await prepareAudio(settings.instrument, setLoading);
      void navigate('/seance');
    } catch {
      setError('Le son n’a pas pu démarrer. Vérifie ta connexion et réessaie.');
    } finally {
      setLoading(null);
    }
  }

  const content: string[] = [];
  if (dueCount > 0) {
    const reviewed = Math.min(dueCount, REVIEW.maxDue);
    content.push(`${reviewed} révision${reviewed > 1 ? 's' : ''}`);
  }
  if (duelCount > 0) {
    const duels = Math.min(duelCount, DAILY.maxDuels);
    content.push(`${duels} duel${duels > 1 ? 's' : ''}`);
  }
  if (current) content.push(stepTitle(current));

  return (
    <section className={card} aria-labelledby="seance-du-jour">
      <h2 id="seance-du-jour" className={cardTitle}>
        Séance du jour
      </h2>
      <DailyGoal todayMs={status.todayActiveMs} goalMs={status.goalMs} streak={status.streak} />
      {nothingToDo ? (
        <p>Tout est à jour : rien à réviser et toutes les étapes sont validées.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="font-medium">{content.join(' · ')}</p>
            {dueCount === 0 && nextDueInDays !== null && (
              <p className={`text-sm ${muted}`}>
                Aucune révision aujourd’hui ; la prochaine, {inDays(nextDueInDays)}.
              </p>
            )}
          </div>
          <button
            type="button"
            className={primaryButton}
            onClick={() => void start()}
            disabled={loading !== null}
          >
            Commencer la séance du jour
          </button>
        </>
      )}
      {loading !== null && (
        <p role="status" className={muted}>
          {loadingLabel(settings.instrument, loading)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
