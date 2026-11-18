import { describe, expect, it } from 'vitest';
import { formatNote, letterIndex, midiOf, noteInfo, pitchClassName } from './notes';

describe('noteInfo', () => {
  it('décrit une note orthographiée', () => {
    expect(noteInfo('F#4')).toEqual({
      name: 'F#4',
      letter: 'F',
      alter: 1,
      octave: 4,
      midi: 66,
      pitchClass: 6,
    });
  });

  it("tient compte de l'octave pour les notes enharmoniques", () => {
    expect(midiOf('Cb4')).toBe(59);
    expect(midiOf('B#3')).toBe(60);
    expect(midiOf('A4')).toBe(69);
  });

  it('refuse une note invalide ou sans octave', () => {
    expect(() => noteInfo('H4')).toThrow();
    expect(() => noteInfo('')).toThrow();
    expect(() => noteInfo('C')).toThrow();
  });
});

describe('formatNote', () => {
  it('utilise par défaut les noms et la numérotation français (Do3 = do central)', () => {
    expect(formatNote('C4')).toBe('Do3');
    expect(formatNote('A4')).toBe('La3');
    expect(formatNote('F#4')).toBe('Fa♯3');
  });

  it('propose la notation anglo-saxonne et la numérotation scientifique', () => {
    expect(formatNote('C4', { naming: 'en', octave: 'scientific' })).toBe('C4');
    expect(formatNote('Bb3', { naming: 'en', octave: 'scientific' })).toBe('B♭3');
    expect(formatNote('C4', { naming: 'fr', octave: 'scientific' })).toBe('Do4');
  });

  it('affiche les doubles altérations', () => {
    expect(formatNote('Bbb3', { octave: 'none' })).toBe('Si♭♭');
    expect(formatNote('F##5', { naming: 'en', octave: 'none' })).toBe('F♯♯');
  });

  it("accepte une classe de hauteur quand l'octave n'est pas affichée", () => {
    expect(formatNote('Eb', { octave: 'none' })).toBe('Mi♭');
    expect(() => formatNote('Eb')).toThrow();
  });
});

describe('utilitaires', () => {
  it("retire l'octave", () => {
    expect(pitchClassName('F#4')).toBe('F#');
    expect(pitchClassName('Bbb2')).toBe('Bbb');
  });

  it('numérote les lettres de do à si', () => {
    expect(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'].map(letterIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(letterIndex('Cb5')).toBe(0);
  });
});
