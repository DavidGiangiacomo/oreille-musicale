// Banques d'échantillons des instruments enregistrés. Les notes absentes s'obtiennent
// en variant la vitesse de lecture de l'échantillon le plus proche.

import type { SampledInstrument } from '../core/exercise/rendition';

export interface Sample {
  /** Nom du fichier sans extension : « A4 », « Ds2 », « Fs5 ». */
  name: string;
  midi: number;
}

const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];

function sample(midi: number): Sample {
  return { name: `${NAMES[midi % 12] ?? ''}${Math.floor(midi / 12) - 1}`, midi };
}

/** Piano : une note tous les 3 demi-tons, de A1 (MIDI 33) à C7 (MIDI 96). */
export const PIANO_SAMPLES: readonly Sample[] = Array.from({ length: 22 }, (_, i) =>
  sample(33 + i * 3),
);

/** Vibraphone : de A3 à E6, toutes les tierces (scripts/prepare-instrument-samples.mjs). */
const VIBRAPHONE_SAMPLES: readonly Sample[] = [57, 60, 64, 67, 71, 74, 77, 81, 84, 88].map(sample);

/** Cordes : violoncelles de C2 à B2, altos de C3 à D6. */
const STRINGS_SAMPLES: readonly Sample[] = [
  36, 40, 43, 47, 48, 50, 52, 55, 59, 62, 65, 69, 72, 76, 79, 83, 86,
].map(sample);

export const SAMPLE_BANKS: Readonly<Record<SampledInstrument, readonly Sample[]>> = {
  piano: PIANO_SAMPLES,
  vibraphone: VIBRAPHONE_SAMPLES,
  strings: STRINGS_SAMPLES,
};

/** Échantillon le plus proche d'une hauteur, et vitesse de lecture pour l'atteindre. */
export function nearestSample(
  midi: number,
  bank: readonly Sample[] = PIANO_SAMPLES,
): { sample: Sample; playbackRate: number } {
  let nearest = bank[0]!;
  for (const candidate of bank) {
    if (Math.abs(candidate.midi - midi) < Math.abs(nearest.midi - midi)) nearest = candidate;
  }
  return { sample: nearest, playbackRate: 2 ** ((midi - nearest.midi) / 12) };
}

/** URL d'un échantillon ; `baseUrl` est la base de l'application (« ./ »). */
export function sampleUrl(
  baseUrl: string,
  name: string,
  instrument: SampledInstrument = 'piano',
): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}samples/${instrument}/${name}.mp3`;
}
