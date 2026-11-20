import { FakeAudioEngine, WebAudioEngine, type AudioEngine } from '../audio';
import type { InstrumentId, NoteEvent } from '../core/exercise/rendition';

/**
 * Moteur audio unique de l'application ; les échantillons sont servis avec elle.
 * Les tests de bout en bout le remplacent par un moteur silencieux
 * (`VITE_FAKE_AUDIO=1`, en développement seulement).
 */
export const audioEngine: AudioEngine =
  import.meta.env.DEV && import.meta.env.VITE_FAKE_AUDIO === '1'
    ? new FakeAudioEngine()
    : new WebAudioEngine({ baseUrl: import.meta.env.BASE_URL });

/**
 * Débloque le son et charge l'instrument. À appeler depuis un clic : le geste de
 * l'utilisateur autorise l'audio pour toute la suite de l'exercice.
 */
export async function prepareAudio(
  instrument: InstrumentId,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  await audioEngine.unlock();
  if (!audioEngine.isLoaded(instrument)) await audioEngine.load(instrument, onProgress);
}

/** Do-mi-sol-do, pour vérifier que le son passe et faire entendre un timbre. */
export const SOUND_CHECK: readonly NoteEvent[] = [60, 64, 67, 72].map((midi, i) => ({
  midi,
  start: i * 0.35,
  duration: 1.6 - i * 0.35,
  velocity: 0.7,
}));

const LOADING_LABELS: Readonly<Record<InstrumentId, string>> = {
  piano: 'Chargement du piano',
  vibraphone: 'Chargement du vibraphone',
  strings: 'Chargement des cordes',
  pure: 'Préparation du son',
  drone: 'Préparation du son',
};

/** « Chargement du vibraphone… 40 % » */
export function loadingLabel(instrument: InstrumentId, ratio: number): string {
  return `${LOADING_LABELS[instrument]}… ${Math.round(ratio * 100)} %`;
}
