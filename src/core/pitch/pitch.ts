// Hauteur chantée (docs/DESIGN.md §11) : de la fréquence détectée à la note, et
// lissage des estimations successives. Fonctions pures, sans audio.
import type { NoteName } from '../theory';

/** Une estimation du détecteur, à un instant donné. */
export interface PitchEstimate {
  /** Instant, en millisecondes. */
  time: number;
  /** Fréquence fondamentale en Hz, ou null si rien de net n'a été entendu. */
  frequency: number | null;
  /** Netteté de la hauteur, de 0 (bruit) à 1 (son parfaitement périodique). */
  clarity: number;
  /** Niveau du signal, en dB par rapport au maximum (0 dBFS). */
  levelDb: number;
}

/** Seuils pour retenir une estimation comme de la voix chantée. */
export interface VoicingThresholds {
  minClarity: number;
  minLevelDb: number;
  minFrequency: number;
  maxFrequency: number;
}

/** De la basse à la soprano (§11.6). Les seuils seront ajustés d'après les essais. */
export const DEFAULT_VOICING: VoicingThresholds = {
  minClarity: 0.9,
  minLevelDb: -50,
  minFrequency: 70,
  maxFrequency: 1100,
};

export function isVoiced(estimate: PitchEstimate, thresholds = DEFAULT_VOICING): boolean {
  return (
    estimate.frequency !== null &&
    estimate.clarity >= thresholds.minClarity &&
    estimate.levelDb >= thresholds.minLevelDb &&
    estimate.frequency >= thresholds.minFrequency &&
    estimate.frequency <= thresholds.maxFrequency
  );
}

/** Hauteur MIDI continue : 69 pour le la 440, 69.5 un quart de ton au-dessus. */
export function midiFromFrequency(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function frequencyFromMidi(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Note la plus proche et écart en cents (de -50 à +50). */
export function nearestNote(midi: number): { midi: number; cents: number } {
  const nearest = Math.round(midi);
  return { midi: nearest, cents: Math.round((midi - nearest) * 100) };
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Nom d'une hauteur MIDI entière, avec dièses : 61 → « C#4 ». */
export function noteNameOf(midi: number): NoteName {
  return `${SHARP_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Lissage d'une suite de hauteurs MIDI (null : pas de voix). Les détecteurs se
 * trompent parfois d'une octave le temps d'une fenêtre : une valeur isolée à une
 * octave près de ses voisines est ramenée à leur octave, puis chaque valeur est
 * remplacée par la médiane de son voisinage.
 */
export function smoothPitches(pitches: readonly (number | null)[], radius = 2): (number | null)[] {
  const corrected = pitches.map((pitch, i) => {
    if (pitch === null) return null;
    const neighbours = pitches
      .slice(Math.max(0, i - radius), i + radius + 1)
      .filter((value, j): value is number => value !== null && j !== Math.min(i, radius));
    if (neighbours.length < 2) return pitch;
    const reference = median(neighbours);
    const octaves = Math.round((reference - pitch) / 12);
    const shifted = pitch + octaves * 12;
    return octaves !== 0 && Math.abs(shifted - reference) < 1 ? shifted : pitch;
  });
  return corrected.map((pitch, i) => {
    if (pitch === null) return null;
    const window = corrected
      .slice(Math.max(0, i - radius), i + radius + 1)
      .filter((value): value is number => value !== null);
    return median(window);
  });
}
