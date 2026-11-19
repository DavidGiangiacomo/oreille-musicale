import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
  accidentalsOf,
  CHORD_QUALITIES,
  CHORDS,
  letterIndex,
  midiOf,
  type ChordQuality,
} from '../theory';
import {
  arpeggiatedEvents,
  chordSoundFrom,
  createChordQuestion,
  DEFAULT_BASS_RANGE,
  invertible,
  inversionItem,
  parseInversionItem,
  recognizableInversed,
  voiceChord,
} from './chordQuestion';
import type { ChordPresentation } from './rendition';

const quality = fc.constantFrom(...CHORD_QUALITIES);
const BASSES = Array.from({ length: 12 }, (_, i) => 48 + i);

/** Décalage de lettre de chaque note par rapport à la fondamentale : 0, 2, 4 pour une triade. */
function letterSteps(q: ChordQuality): number[] {
  return CHORDS[q].intervals.map((interval) => parseInt(interval, 10) - 1);
}

describe('voiceChord', () => {
  it('donne toutes les qualités sur les 12 fondamentales, dans tous les renversements', () => {
    for (const q of CHORD_QUALITIES) {
      const size = CHORDS[q].semitones.length;
      for (const bass of BASSES) {
        for (let inversion = 0; inversion < size; inversion++) {
          const { notes, midi, root, rootMidi } = voiceChord(q, bass, inversion);
          const label = `${q} basse ${bass} renversement ${inversion}`;
          // Basse demandée, position serrée, notes de bas en haut.
          expect(midi[0], label).toBe(bass);
          expect(midi, label).toEqual(notes.map(midiOf));
          expect(
            midi.every((m, i) => i === 0 || m > (midi[i - 1] as number)),
            label,
          ).toBe(true);
          expect((midi.at(-1) as number) - bass, label).toBeLessThan(12);
          // Les bonnes notes : mêmes classes de hauteur que l'accord sur sa fondamentale.
          const classes = midi.map((m) => (((m - rootMidi) % 12) + 12) % 12).sort((a, b) => a - b);
          expect(classes, label).toEqual([...CHORDS[q].semitones].sort((a, b) => a - b));
          // Une lettre par note de l'accord (tierces superposées, ou quarte et seconde).
          const letters = notes.map((note) => (letterIndex(note) - letterIndex(root) + 7) % 7);
          expect([...letters].sort(), label).toEqual(
            letterSteps(q)
              .map((s) => s % 7)
              .sort(),
          );
          // Pas de double altération, sauf septième diminuée et quinte augmentée de Si.
          if (q !== 'dim7' && q !== 'aug') {
            expect(
              notes.every((note) => accidentalsOf(note) < 2),
              `${label} : ${notes.join(' ')}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('orthographie avec le moins d’altérations possible', () => {
    expect(voiceChord('maj', 49, 0).notes).toEqual(['Db3', 'F3', 'Ab3']);
    expect(voiceChord('min', 54, 0).notes).toEqual(['F#3', 'A3', 'C#4']);
    expect(voiceChord('dim7', 48, 0).notes).toEqual(['C3', 'Eb3', 'Gb3', 'Bbb3']);
    expect(voiceChord('dom7', 52, 1).notes).toEqual(['E3', 'G3', 'Bb3', 'C4']);
    expect(voiceChord('maj', 55, 2).notes).toEqual(['G3', 'C4', 'E4']);
  });
});

describe('createChordQuestion', () => {
  const presentation = fc.constantFrom<ChordPresentation>('arp', 'block', 'inv');

  it('respecte le registre de la basse, la présentation et la question précédente', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        quality,
        presentation,
        fc.option(fc.integer({ min: 48, max: 60 }), { nil: null }),
        (seed, q, pres, previous) => {
          fc.pre(pres !== 'inv' || recognizableInversed(q));
          const question = createChordQuestion({
            family: 'chd',
            item: q,
            presentation: pres,
            choices: ['maj', 'min', q],
            random: createRandom(seed),
            previousAnchor: previous,
          });
          const [low, high] = DEFAULT_BASS_RANGE;
          expect(question.midi[0]).toBeGreaterThanOrEqual(low);
          expect(question.midi[0]).toBeLessThanOrEqual(high);
          expect(question.anchor).toBe(question.midi[0]);
          expect(question.anchor).not.toBe(previous);
          expect(question).toMatchObject({
            family: 'chd',
            item: q,
            answer: q,
            competenceId: `chd:${q}:${pres}`,
            quality: q,
          });
          if (pres !== 'inv') expect(question.inversion).toBe(0);
          const starts = question.events.map((event) => event.start);
          if (pres === 'arp') {
            expect(starts).toEqual([...starts].sort((a, b) => a - b));
            expect(new Set(starts).size).toBe(starts.length);
          } else {
            expect(starts.every((start) => start === 0)).toBe(true);
          }
          // Toutes les notes s'arrêtent ensemble.
          const ends = question.events.map((event) => event.start + event.duration);
          expect(Math.max(...ends) - Math.min(...ends)).toBeLessThan(1e-9);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('varie le renversement en plaqué renversé', () => {
    const random = createRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      seen.add(
        createChordQuestion({
          family: 'chd',
          item: 'dom7',
          presentation: 'inv',
          choices: ['dom7'],
          random,
        }).inversion,
      );
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('refuse les accords suspendus en plaqué renversé et une réponse absente', () => {
    const base = { family: 'chd' as const, random: createRandom(1) };
    expect(() =>
      createChordQuestion({ ...base, item: 'sus4', presentation: 'inv', choices: ['sus4'] }),
    ).toThrow();
    expect(() =>
      createChordQuestion({ ...base, item: 'maj', presentation: 'block', choices: ['min'] }),
    ).toThrow();
  });

  it('pose le renversement d’un accord, basse comprise', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: 3 }), (seed, inversion) => {
        const item = inversionItem('dom7', inversion);
        const question = createChordQuestion({
          family: 'inv',
          item,
          presentation: 'block',
          choices: ['inv0', 'inv1', 'inv2', 'inv3'],
          random: createRandom(seed),
        });
        expect(question).toMatchObject({
          answer: `inv${inversion}`,
          competenceId: `inv:${item}:block`,
          inversion,
        });
        const bassInterval = (((question.midi[0] as number) - question.rootMidi) % 12) + 0;
        expect(bassInterval).toBe(CHORDS.dom7.semitones[inversion]);
      }),
    );
  });
});

describe('éléments du parcours Renversements', () => {
  it('exclut les accords suspendus et symétriques', () => {
    expect(parseInversionItem('maj.2')).toEqual({ quality: 'maj', inversion: 2 });
    expect(parseInversionItem('dom7.3')).toEqual({ quality: 'dom7', inversion: 3 });
    expect(parseInversionItem('maj.3')).toBeNull();
    expect(parseInversionItem('aug.1')).toBeNull();
    expect(parseInversionItem('dim7.1')).toBeNull();
    expect(parseInversionItem('sus4.0')).toBeNull();
    expect(parseInversionItem('maj')).toBeNull();
    expect(invertible('min')).toBe(true);
    expect(invertible('7sus4')).toBe(false);
  });
});

describe('écoute comparée et aide', () => {
  it('rejoue un autre accord sur la même fondamentale', () => {
    const question = createChordQuestion({
      family: 'chd',
      item: 'min',
      presentation: 'inv',
      choices: ['maj', 'min'],
      random: createRandom(3),
    });
    const other = chordSoundFrom(question, 'maj', question.inversion);
    const root = question.rootMidi;
    expect(other.midi.map((m) => (m - root + 120) % 12).sort((a, b) => a - b)).toEqual([0, 4, 7]);
    // Une septième sur la même fondamentale, renversement ramené au dernier possible.
    expect(chordSoundFrom(question, 'dom7', 3).midi).toHaveLength(4);
    expect(chordSoundFrom(question, 'maj', 3).midi).toHaveLength(3);
  });

  it('arpège l’accord plaqué, en montant', () => {
    const question = createChordQuestion({
      family: 'chd',
      item: 'maj7',
      presentation: 'block',
      choices: ['maj7'],
      random: createRandom(4),
    });
    const events = arpeggiatedEvents(question);
    expect(events.map((e) => e.midi)).toEqual(question.midi);
    expect(events.map((e) => e.start)).toEqual([0, 0.45, 0.9, 1.35].map((t) => expect.closeTo(t)));
  });
});
