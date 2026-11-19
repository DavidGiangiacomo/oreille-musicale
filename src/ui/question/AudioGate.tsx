import { useState, type ReactNode } from 'react';
import { audioEngine } from '../audio';
import { useSettings } from '../settings/settingsContext';
import { card, muted, primaryButton } from '../styles';

/**
 * Affiche son contenu une fois le son débloqué et l'instrument chargé. Si la page
 * a été ouverte directement (sans geste de l'utilisateur), propose de démarrer.
 */
export function AudioGate({ children, label }: { children: ReactNode; label: string }) {
  const { settings } = useSettings();
  const [ready, setReady] = useState(
    () => audioEngine.running && audioEngine.isLoaded(settings.instrument),
  );
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    try {
      await audioEngine.unlock();
      if (!audioEngine.isLoaded(settings.instrument)) {
        setLoading(0);
        await audioEngine.load(settings.instrument, setLoading);
      }
      setReady(true);
    } catch {
      setError('Le son n’a pas pu démarrer. Vérifie le volume et ta connexion, puis réessaie.');
    } finally {
      setLoading(null);
    }
  }

  if (ready) return children;
  return (
    <section className={card}>
      <p>Active le son pour commencer.</p>
      <button
        type="button"
        className={primaryButton}
        onClick={() => void start()}
        disabled={loading !== null}
      >
        {label}
      </button>
      {loading !== null && (
        <p role="status" className={muted}>
          Chargement du piano… {Math.round(loading * 100)} %
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
