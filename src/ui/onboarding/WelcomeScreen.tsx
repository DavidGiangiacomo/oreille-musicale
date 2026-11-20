import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatNote } from '../../core/theory';
import { audioEngine, prepareAudio } from '../audio';
import { OptionGroup } from '../components/OptionGroup';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted, primaryButton, secondaryButton } from '../styles';

/** Do-mi-sol-do, pour vérifier que le son passe. */
const TEST_CHORD = [60, 64, 67, 72].map((midi, i) => ({
  midi,
  start: i * 0.35,
  duration: 1.6 - i * 0.35,
  velocity: 0.7,
}));

/** Premier lancement (§9.3) : test du son, choix de la notation, niveau. */
export function WelcomeScreen() {
  const { settings, updateSettings } = useSettings();
  const navigate = useNavigate();
  const [heard, setHeard] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function testSound() {
    setError(null);
    try {
      setLoading(0);
      await prepareAudio(settings.instrument, setLoading);
      audioEngine.play(TEST_CHORD, { instrument: settings.instrument });
      setHeard(true);
    } catch {
      setError('Le son n’a pas pu démarrer. Vérifie ta connexion et réessaie.');
    } finally {
      setLoading(null);
    }
  }

  function finish(to: string) {
    updateSettings({ onboardingDone: true });
    void navigate(to, { replace: true });
  }

  const example = formatNote('C4', {
    naming: settings.noteNames,
    octave: settings.octaveConvention,
  });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Bienvenue !</h1>
        <p className={muted}>
          Oreille musicale t'apprend à reconnaître intervalles, accords, gammes et modes à
          l'oreille, étape par étape : on écoute, on répond, et on revient un peu chaque jour.
        </p>
      </header>

      <section className={card} aria-labelledby="son">
        <h2 id="son" className={cardTitle}>
          1. Le son
        </h2>
        <p className={muted}>
          Règle le volume de ton appareil. Des écouteurs donnent le meilleur résultat.
        </p>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => void testSound()}
          disabled={loading !== null}
        >
          <span aria-hidden="true">▶ </span>Écouter un accord
        </button>
        {loading !== null && (
          <p role="status" className={muted}>
            Chargement du piano… {Math.round(loading * 100)} %
          </p>
        )}
        {heard && <p role="status">Tu as entendu do, mi, sol, do ? Le son fonctionne.</p>}
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </section>

      <section className={card} aria-labelledby="notation">
        <h2 id="notation" className={cardTitle}>
          2. La notation
        </h2>
        <OptionGroup
          legend="Noms des notes"
          value={settings.noteNames}
          options={[
            { value: 'fr', label: 'Do Ré Mi' },
            { value: 'en', label: 'C D E' },
          ]}
          onChange={(noteNames) => updateSettings({ noteNames })}
        />
        <OptionGroup
          legend="Numérotation des octaves"
          value={settings.octaveConvention}
          options={[
            { value: 'fr', label: 'Française (do central = 3)' },
            { value: 'scientific', label: 'Scientifique (do central = 4)' },
          ]}
          onChange={(octaveConvention) => updateSettings({ octaveConvention })}
        />
        <p className={muted}>
          Le do central s'écrira « {example} ». Tu pourras changer ces choix dans les préférences.
        </p>
      </section>

      <section className={card} aria-labelledby="niveau">
        <h2 id="niveau" className={cardTitle}>
          3. Ton niveau
        </h2>
        <p className={muted}>
          Tu débutes ? Le parcours commence par trois repères. Tu as déjà des bases ? Un test rapide
          valide d’emblée les étapes que tu maîtrises.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className={primaryButton} onClick={() => finish('/')}>
            C'est parti
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => finish('/positionnement')}
          >
            J'ai déjà des bases
          </button>
        </div>
      </section>
    </main>
  );
}
