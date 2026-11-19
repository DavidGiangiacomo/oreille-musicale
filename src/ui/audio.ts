import { FakeAudioEngine, WebAudioEngine, type AudioEngine } from '../audio';
import type { InstrumentId } from '../core/exercise/rendition';

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
