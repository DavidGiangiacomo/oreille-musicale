import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import {
  answersFor,
  competenceId,
  createQuestion,
  FAMILIES,
  parseCompetence,
  sortAnswers,
} from './families';

describe('compétences', () => {
  it('se lisent pour les trois familles', () => {
    expect(parseCompetence('int:m3:asc')).toEqual({
      family: 'int',
      item: 'm3',
      presentation: 'asc',
    });
    expect(parseCompetence('chd:m7b5:inv')).toEqual({
      family: 'chd',
      item: 'm7b5',
      presentation: 'inv',
    });
    expect(parseCompetence('inv:maj.1:block')).toEqual({
      family: 'inv',
      item: 'maj.1',
      presentation: 'block',
    });
    expect(competenceId('chd', 'min', 'arp')).toBe('chd:min:arp');
    for (const invalid of ['int:m3:arp', 'chd:m3:block', 'inv:aug.1:block', 'xyz:a:b', 'int:m3']) {
      expect(parseCompetence(invalid), invalid).toBeNull();
    }
  });
});

describe('réponses', () => {
  it('suivent l’ordre fixe des boutons', () => {
    expect(sortAnswers('int', ['P8', 'M3', 'P5'])).toEqual(['M3', 'P5', 'P8']);
    expect(sortAnswers('chd', ['dom7', 'min', 'maj', 'aug'])).toEqual([
      'maj',
      'min',
      'aug',
      'dom7',
    ]);
    expect(answersFor('inv', ['min.2', 'maj.0', 'min.0', 'maj.1'])).toEqual([
      'inv0',
      'inv1',
      'inv2',
    ]);
  });

  it('mesurent l’écart entre deux réponses', () => {
    expect(FAMILIES.int.distance('m3', 'P5')).toBe(4);
    expect(FAMILIES.chd.distance('maj', 'min')).toBe(1);
    expect(FAMILIES.inv.distance('inv0', 'inv2')).toBe(2);
  });
});

describe('écoute comparée', () => {
  it('rejoue un autre renversement du même accord', () => {
    const question = createQuestion('inv', {
      item: 'min.1',
      presentation: 'block',
      choices: ['inv0', 'inv1', 'inv2'],
      random: createRandom(2),
    });
    const inversions = FAMILIES.inv;
    expect(inversions.itemFor(question, 'inv2')).toBe('min.2');
    const sound = inversions.soundFrom(question, 'min.2');
    expect(sound.midi).toHaveLength(3);
    // Basse de l'accord rejoué : la quinte de la même fondamentale.
    expect(((sound.midi[0] as number) - (question as { rootMidi: number }).rootMidi) % 12).toBe(7);
  });

  it('rejoue un autre intervalle depuis la même note', () => {
    const question = createQuestion('int', {
      item: 'M3',
      presentation: 'asc',
      choices: ['M3', 'P5'],
      random: createRandom(1),
    });
    const sound = FAMILIES.int.soundFrom(question, 'P5');
    expect(sound.midi[0]).toBe(question.midi[0]);
    expect((sound.midi[1] as number) - (sound.midi[0] as number)).toBe(7);
  });
});

describe('ajustement de la difficulté', () => {
  it('garde la basse des accords au-dessus de C3', () => {
    const base = { range: [48, 60] as const, tempo: 'normal' as const };
    for (const difficulty of ['easier', 'normal', 'harder'] as const) {
      expect(FAMILIES.chd.generationFor(base, difficulty).range[0]).toBeGreaterThanOrEqual(48);
    }
    expect(FAMILIES.int.generationFor(base, 'easier').tempo).toBe('slow');
  });
});
