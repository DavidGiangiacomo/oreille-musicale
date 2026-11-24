// Écoute du micro pour les exercices chantés (docs/DESIGN.md §11.6). Le son n'est
// ni enregistré ni transmis : chaque fenêtre est analysée puis oubliée, seule la
// hauteur détectée en sort.
import type { PitchEstimate } from '../core/pitch/pitch';
import { createPitchDetector, WINDOW_SIZE } from './pitchDetector';

/** Une analyse toutes les 20 ms : 50 estimations par seconde. */
const PERIOD_MS = 20;

export type MicrophoneError = 'denied' | 'missing' | 'unsupported' | 'failed';

export class MicrophoneUnavailable extends Error {
  readonly reason: MicrophoneError;

  constructor(reason: MicrophoneError) {
    super(`Micro indisponible : ${reason}`);
    this.reason = reason;
  }
}

/** Écoute en cours ; `stop()` coupe le micro. */
export interface Listening {
  readonly sampleRate: number;
  stop(): void;
}

function reasonOf(error: unknown): MicrophoneError {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  return 'failed';
}

/**
 * Ouvre le micro et appelle `onEstimate` à chaque analyse. Les traitements faits
 * pour la visioconférence (annulation d'écho, réduction de bruit, gain automatique)
 * sont désactivés : ils déforment la voix et gênent la détection.
 */
export async function listenToPitch(
  onEstimate: (estimate: PitchEstimate) => void,
): Promise<Listening> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneUnavailable('unsupported');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (error) {
    throw new MicrophoneUnavailable(reasonOf(error));
  }

  const context = new AudioContext();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = WINDOW_SIZE;
  source.connect(analyser);
  const samples = new Float32Array(WINDOW_SIZE);
  const detect = createPitchDetector(WINDOW_SIZE);

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    onEstimate({ time: performance.now(), ...detect(samples, context.sampleRate) });
  }, PERIOD_MS);

  return {
    sampleRate: context.sampleRate,
    stop: () => {
      window.clearInterval(timer);
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  };
}
