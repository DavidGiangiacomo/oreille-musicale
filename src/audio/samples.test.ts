import { describe, expect, it } from 'vitest';
import { PIANO_SAMPLES, nearestSample, sampleUrl } from './samples';

describe('PIANO_SAMPLES', () => {
  it('couvre A1 à C7 par tierces mineures', () => {
    expect(PIANO_SAMPLES).toHaveLength(22);
    expect(PIANO_SAMPLES[0]).toEqual({ name: 'A1', midi: 33 });
    expect(PIANO_SAMPLES.at(-1)).toEqual({ name: 'C7', midi: 96 });
    expect(PIANO_SAMPLES.slice(8, 13).map((s) => s.name)).toEqual(['A3', 'C4', 'Ds4', 'Fs4', 'A4']);
  });
});

describe('nearestSample', () => {
  it('joue un échantillon tel quel ou décalé d’un demi-ton au plus', () => {
    expect(nearestSample(60)).toEqual({ sample: { name: 'C4', midi: 60 }, playbackRate: 1 });
    expect(nearestSample(61).sample.name).toBe('C4');
    expect(nearestSample(61).playbackRate).toBeCloseTo(2 ** (1 / 12));
    expect(nearestSample(62).sample.name).toBe('Ds4');
    expect(nearestSample(62).playbackRate).toBeCloseTo(2 ** (-1 / 12));
    for (let midi = 32; midi <= 97; midi++) {
      expect(Math.abs(nearestSample(midi).sample.midi - midi)).toBeLessThanOrEqual(1);
    }
  });

  it('se rabat sur l’échantillon extrême hors de la tessiture', () => {
    expect(nearestSample(20).sample.name).toBe('A1');
    expect(nearestSample(108).sample.name).toBe('C7');
  });
});

describe('sampleUrl', () => {
  it('construit une URL relative à la base de l’application', () => {
    expect(sampleUrl('./', 'A4')).toBe('./samples/piano/A4.mp3');
    expect(sampleUrl('/oreille-musicale', 'Ds2')).toBe('/oreille-musicale/samples/piano/Ds2.mp3');
  });
});
