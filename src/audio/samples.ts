// Échantillons de piano : une note tous les 3 demi-tons, de A1 (MIDI 33) à C7 (MIDI 96).
// Les notes intermédiaires s'obtiennent en variant la vitesse de lecture d'un demi-ton au plus.

export interface PianoSample {
  /** Nom du fichier sans extension : « A4 », « Ds2 », « Fs5 ». */
  name: string;
  midi: number;
}

const LOWEST = 33;
const HIGHEST = 96;
const STEP = 3;
const LETTERS = new Map<number, string>([
  [9, 'A'],
  [0, 'C'],
  [3, 'Ds'],
  [6, 'Fs'],
]);

export const PIANO_SAMPLES: readonly PianoSample[] = Array.from(
  { length: (HIGHEST - LOWEST) / STEP + 1 },
  (_, i) => {
    const midi = LOWEST + i * STEP;
    return { name: `${LETTERS.get(midi % 12) ?? ''}${Math.floor(midi / 12) - 1}`, midi };
  },
);

/** Échantillon le plus proche d'une hauteur, et vitesse de lecture pour l'atteindre. */
export function nearestSample(midi: number): { sample: PianoSample; playbackRate: number } {
  let sample = PIANO_SAMPLES[0]!;
  for (const candidate of PIANO_SAMPLES) {
    if (Math.abs(candidate.midi - midi) < Math.abs(sample.midi - midi)) sample = candidate;
  }
  return { sample, playbackRate: 2 ** ((midi - sample.midi) / 12) };
}

/** URL d'un échantillon ; `baseUrl` est la base de l'application (« ./ »). */
export function sampleUrl(baseUrl: string, name: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}samples/piano/${name}.mp3`;
}
