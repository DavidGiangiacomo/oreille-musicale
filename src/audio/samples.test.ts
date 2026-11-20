import { describe, expect, it } from 'vitest';
import { PIANO_SAMPLES, SAMPLE_BANKS, nearestSample, sampleUrl } from './samples';

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

describe('SAMPLE_BANKS', () => {
  it('nomme les notes comme les fichiers préparés', () => {
    expect(SAMPLE_BANKS.vibraphone.map((s) => s.name)).toEqual([
      'A3',
      'C4',
      'E4',
      'G4',
      'B4',
      'D5',
      'F5',
      'A5',
      'C6',
      'E6',
    ]);
    expect(SAMPLE_BANKS.strings[0]).toEqual({ name: 'C2', midi: 36 });
    expect(SAMPLE_BANKS.strings.at(-1)).toEqual({ name: 'D6', midi: 86 });
  });

  it('transpose de 2 demi-tons au plus dans la tessiture de chaque instrument', () => {
    for (const bank of Object.values(SAMPLE_BANKS)) {
      const low = bank[0]!.midi;
      const high = bank.at(-1)!.midi;
      for (let midi = low; midi <= high; midi++) {
        expect(Math.abs(nearestSample(midi, bank).sample.midi - midi)).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('sampleUrl', () => {
  it('construit une URL relative à la base de l’application', () => {
    expect(sampleUrl('./', 'A4')).toBe('./samples/piano/A4.mp3');
    expect(sampleUrl('/oreille-musicale', 'Ds2')).toBe('/oreille-musicale/samples/piano/Ds2.mp3');
    expect(sampleUrl('./', 'C4', 'strings')).toBe('./samples/strings/C4.mp3');
  });
});
