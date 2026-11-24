// Détection de la hauteur d'une voix seule (docs/DESIGN.md §11.6) : algorithme de
// McLeod (MPM, bibliothèque pitchy) sur une fenêtre d'échantillons. Fonction pure,
// testée sur des signaux synthétiques ; la capture du micro est à part.
import { PitchDetector } from 'pitchy';
import type { PitchEstimate } from '../core/pitch/pitch';

/** Fenêtre d'analyse : environ 43 ms à 48 kHz, trois périodes d'une note de basse (70 Hz). */
export const WINDOW_SIZE = 2048;

export type Detection = Omit<PitchEstimate, 'time'>;

/** Niveau d'un signal (moyenne quadratique), en dB par rapport au maximum. */
export function levelDb(samples: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
}

/** Un détecteur pour des fenêtres de `size` échantillons (tampons réutilisés). */
export function createPitchDetector(size = WINDOW_SIZE) {
  const detector = PitchDetector.forFloat32Array(size);
  // Le seuil de niveau est appliqué ensuite (isVoiced), pour pouvoir l'afficher et le régler.
  detector.minVolumeDecibels = -100;
  return (samples: Float32Array, sampleRate: number): Detection => {
    const [frequency, clarity] = detector.findPitch(samples, sampleRate);
    return {
      frequency: frequency > 0 && Number.isFinite(frequency) ? frequency : null,
      clarity: Number.isFinite(clarity) ? clarity : 0,
      levelDb: levelDb(samples),
    };
  };
}
