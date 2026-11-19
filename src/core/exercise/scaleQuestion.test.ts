import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
  accidentalsOf,
  letterIndex,
  midiOf,
  MODE_CODES,
  MODES,
  SCALE_CODES,
  SCALES,
  type ModeCode,
} from '../theory';
import {
  characteristicNotes,
  createScaleQuestion,
  DRONE_VELOCITY,
  focusDegrees,
  melodyIssues,
  modalMelody,
  scaleDegrees,
  scaleSequence,
  scaleSoundFrom,
  type ScaleQuestion,
} from './scaleQuestion';
import type { ModePresentation, ScalePresentation } from './rendition';

const TONICS = Array.from({ length: 12 }, (_, i) => 48 + i);
const pitchClasses = (midi: readonly number[], tonic: number) =>
  [...new Set(midi.map((m) => (((m - tonic) % 12) + 12) % 12))].sort((a, b) => a - b);

describe('gammes et modes sur les 12 toniques', () => {
  it('ont les bonnes notes, une lettre par degré et peu d’altérations', () => {
    for (const code of [...SCALE_CODES, ...MODE_CODES]) {
      const def = code in SCALES ? SCALES[code as keyof typeof SCALES] : MODES[code as ModeCode];
      for (const tonic of TONICS) {
        const { degrees } = scaleDegrees(tonic, code);
        const midi = degrees.map(midiOf);
        const label = `${code} sur ${tonic} : ${degrees.join(' ')}`;
        expect(midi[0], label).toBe(tonic);
        expect(midi.at(-1), label).toBe(tonic + 12);
        expect(
          midi.every((m, i) => i === 0 || m > (midi[i - 1] as number)),
          label,
        ).toBe(true);
        expect(pitchClasses(midi, tonic), label).toEqual([...def.semitones]);
        if (def.semitones.length === 7) {
          // Gammes heptatoniques : une lettre par degré (§6.5).
          const letters = degrees.slice(0, 7).map(letterIndex);
          expect(new Set(letters).size, label).toBe(7);
          expect(
            degrees.every((note) => accidentalsOf(note) < 2),
            label,
          ).toBe(true);
        }
      }
    }
  });

  it('écrit Ré majeur avec deux dièses et Si♭ mineur naturel avec cinq bémols', () => {
    expect(scaleDegrees(50, 'major').degrees).toEqual([
      'D3',
      'E3',
      'F#3',
      'G3',
      'A3',
      'B3',
      'C#4',
      'D4',
    ]);
    expect(scaleDegrees(58, 'natmin').degrees.slice(0, 7)).toEqual([
      'Bb3',
      'C4',
      'Db4',
      'Eb4',
      'F4',
      'Gb4',
      'Ab4',
    ]);
  });

  it('fait redescendre la mineure mélodique en mineure naturelle, sur la même tonique', () => {
    for (const tonic of TONICS) {
      const sequence = scaleSequence(tonic, 'melmin', 'updown');
      expect(sequence).toHaveLength(15);
      const up = sequence.slice(0, 8).map(midiOf);
      const down = sequence.slice(7).map(midiOf);
      expect(pitchClasses(up, tonic)).toEqual([0, 2, 3, 5, 7, 9, 11]);
      expect(pitchClasses(down, tonic)).toEqual([0, 2, 3, 5, 7, 8, 10]);
      expect(sequence[0]?.replace(/\d/, '')).toBe(sequence.at(-1)?.replace(/\d/, ''));
    }
  });
});

describe('createScaleQuestion', () => {
  const scalePresentation = fc.constantFrom<ScalePresentation>('updown', 'asc', 'desc');
  const modePresentation = fc.constantFrom<ModePresentation>('drone', 'plain', 'melody');

  it('joue la gamme dans le registre, selon la présentation', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.constantFrom(...SCALE_CODES),
        scalePresentation,
        fc.option(fc.integer({ min: 48, max: 60 }), { nil: null }),
        (seed, code, presentation, previous) => {
          fc.pre(!(code === 'melmin' && presentation === 'desc'));
          const q = createScaleQuestion({
            family: 'scl',
            item: code,
            presentation,
            choices: [code],
            random: createRandom(seed),
            previousAnchor: previous,
          });
          expect(q.tonicMidi).toBeGreaterThanOrEqual(48);
          expect(q.tonicMidi).toBeLessThanOrEqual(60);
          expect(q.tonicMidi).not.toBe(previous);
          const size = SCALES[code].semitones.length;
          expect(q.notes).toHaveLength(presentation === 'updown' ? 2 * size + 1 : size + 1);
          expect(q.midi[0]).toBe(presentation === 'desc' ? q.tonicMidi + 12 : q.tonicMidi);
          expect(q.events.every((e) => e.instrument !== 'drone')).toBe(true);
          const starts = q.events.map((e) => e.start);
          expect(starts).toEqual([...starts].sort((a, b) => a - b));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('pose les modes sur un bourdon plus doux, qui commence une seconde avant', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.constantFrom(...MODE_CODES),
        modePresentation,
        (seed, code, presentation) => {
          const q = createScaleQuestion({
            family: 'mod',
            item: code,
            presentation,
            choices: [...MODE_CODES],
            random: createRandom(seed),
          });
          const drone = q.events.filter((e) => e.instrument === 'drone');
          const melodic = q.events.filter((e) => e.instrument !== 'drone');
          if (presentation === 'plain') {
            expect(drone).toEqual([]);
          } else {
            expect(drone.map((e) => e.midi)).toEqual([q.tonicMidi - 12, q.tonicMidi]);
            expect(drone.every((e) => e.start === 0 && e.velocity === DRONE_VELOCITY)).toBe(true);
            expect(melodic[0]?.start).toBe(1);
            const end = Math.max(...melodic.map((e) => e.start + e.duration));
            expect(drone[0]!.duration).toBeGreaterThanOrEqual(end);
            expect(DRONE_VELOCITY).toBeLessThan(melodic[0]!.velocity);
          }
          if (presentation === 'melody') {
            expect(q.melody).not.toBeNull();
            expect(melodyIssues(code, q.melody!)).toEqual([]);
          } else {
            expect(q.notes).toHaveLength(15);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('refuse la mineure mélodique descendante seule', () => {
    expect(() =>
      createScaleQuestion({
        family: 'scl',
        item: 'melmin',
        presentation: 'desc',
        choices: ['melmin'],
        random: createRandom(1),
      }),
    ).toThrow();
  });
});

describe('mélodies modales', () => {
  it('respectent toutes leurs contraintes, quelle que soit la graine', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...MODE_CODES), (seed, code) => {
        const melody = modalMelody(code, createRandom(seed));
        expect(melodyIssues(code, melody)).toEqual([]);
        expect(melody.steps[0]).toBe(0);
        expect([0, 7]).toContain(melody.steps.at(-1));
      }),
      { numRuns: 500 },
    );
  });

  it('détectent une mélodie qui ne fait pas entendre la note caractéristique', () => {
    expect(focusDegrees('dorian')).toEqual([5]);
    const flat = { steps: [0, 1, 2, 3, 4, 3, 2, 1, 0], beats: [1, 1, 1, 1, 1, 1, 1, 1, 3] };
    expect(melodyIssues('dorian', flat)).toContain('note caractéristique');
    expect(melodyIssues('dorian', { ...flat, steps: [0, 5, 0, 1, 2, 1, 2, 1, 0] })).toContain(
      'saut',
    );
  });
});

describe('écoute comparée et note caractéristique', () => {
  const question = (presentation: ModePresentation) =>
    createScaleQuestion({
      family: 'mod',
      item: 'dorian',
      presentation,
      choices: [...MODE_CODES],
      random: createRandom(5),
    }) as ScaleQuestion;

  it('rejoue la même mélodie dans le mode de référence', () => {
    const q = question('melody');
    const reference = scaleSoundFrom(q, 'aeolian');
    expect(reference.midi).toHaveLength(q.midi.length);
    // Seule la sixte change : majeure en dorien, mineure en éolien.
    q.midi.forEach((m, i) => {
      const step = q.melody!.steps[i];
      expect(reference.midi[i]).toBe(step === 5 ? m - 1 : m);
    });
  });

  it('désigne la note caractéristique sur la tonique', () => {
    const q = question('drone');
    const sixth = characteristicNotes(q);
    expect(sixth).toHaveLength(1);
    expect(midiOf(sixth[0]!) - q.tonicMidi).toBe(9);
    expect(characteristicNotes({ ...q, code: 'ionian' })).toEqual([]);
  });
});
