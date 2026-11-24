import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isVoiced, midiFromFrequency } from '../core/pitch/pitch';
import { createPitchDetector, levelDb, WINDOW_SIZE } from './pitchDetector';

const SAMPLE_RATE = 48_000;

/** Une note « chantée » synthétique : fondamentale, harmoniques décroissants, vibrato, bruit. */
function voice(
  frequency: number,
  options: {
    harmonics?: number;
    vibratoCents?: number;
    noise?: number;
    amplitude?: number;
    seed?: number;
  } = {},
): Float32Array {
  const { harmonics = 6, vibratoCents = 0, noise = 0, amplitude = 0.3, seed = 1 } = options;
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32 - 0.5;
  };
  const samples = new Float32Array(WINDOW_SIZE);
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const f = frequency * 2 ** ((vibratoCents / 1200) * Math.sin(2 * Math.PI * 5.5 * t));
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    let value = 0;
    for (let h = 1; h <= harmonics; h++) value += Math.sin(h * phase) / h;
    samples[i] = amplitude * (value / 2) + noise * random();
  }
  return samples;
}

const cents = (detected: number, expected: number) =>
  Math.abs(midiFromFrequency(detected) - midiFromFrequency(expected)) * 100;

describe('détection de la hauteur', () => {
  const detect = createPitchDetector();

  it('trouve la note d’une voix, de la basse à la soprano, à quelques cents près', () => {
    fc.assert(
      fc.property(fc.integer({ min: 75, max: 1050 }), (frequency) => {
        const result = detect(voice(frequency), SAMPLE_RATE);
        expect(result.frequency).not.toBeNull();
        expect(cents(result.frequency!, frequency)).toBeLessThan(10);
        expect(result.clarity).toBeGreaterThan(0.9);
      }),
      { numRuns: 60 },
    );
  });

  it('tient avec un léger vibrato et un peu de bruit', () => {
    for (const frequency of [98, 220, 440, 659]) {
      const result = detect(voice(frequency, { vibratoCents: 20, noise: 0.02 }), SAMPLE_RATE);
      expect(cents(result.frequency!, frequency)).toBeLessThan(30);
      expect(isVoiced({ time: 0, ...result })).toBe(true);
    }
  });

  it('ne prend pas le bruit ni le silence pour une note', () => {
    const silence = detect(new Float32Array(WINDOW_SIZE), SAMPLE_RATE);
    expect(isVoiced({ time: 0, ...silence })).toBe(false);
    const noise = detect(voice(220, { amplitude: 0, noise: 0.3, seed: 7 }), SAMPLE_RATE);
    expect(isVoiced({ time: 0, ...noise })).toBe(false);
  });

  it('mesure le niveau en dB', () => {
    expect(levelDb(new Float32Array(10))).toBe(-100);
    expect(levelDb(new Float32Array(10).fill(1))).toBeCloseTo(0);
    expect(levelDb(new Float32Array(10).fill(0.1))).toBeCloseTo(-20);
  });
});
