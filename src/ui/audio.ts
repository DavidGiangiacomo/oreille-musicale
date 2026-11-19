import { WebAudioEngine } from '../audio';
import type { InstrumentId } from '../core/exercise/rendition';

/** Moteur audio unique de l'application ; les échantillons sont servis avec elle. */
export const audioEngine = new WebAudioEngine({ baseUrl: import.meta.env.BASE_URL });

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
