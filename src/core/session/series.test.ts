import { describe, expect, it } from 'vitest';
import { createRandom } from '../random';
import type { IntervalCode } from '../theory';
import {
  advance,
  answerCurrent,
  createSeriesConfig,
  currentEntry,
  seriesSummary,
  startSeries,
  type SeriesState,
} from './series';

const metrics = { responseTimeMs: 1200, replays: 0 };

/** Joue une série entière en répondant juste sauf pour les éléments donnés. */
function play(state: SeriesState, seed: number, wrongFor: IntervalCode[] = []): SeriesState {
  const random = createRandom(seed);
  let current = state;
  while (current.status !== 'finished') {
    const { question } = currentEntry(current);
    const answer = wrongFor.includes(question.item)
      ? (question.choices.find((c) => c !== question.item) ?? question.item)
      : question.item;
    current = answerCurrent(current, answer, metrics);
    current = advance(current, random);
  }
  return current;
}

describe('createSeriesConfig', () => {
  it('trie les intervalles et applique les valeurs par défaut', () => {
    const config = createSeriesConfig(['P8', 'M3', 'P5'], 'asc');
    expect(config).toMatchObject({ items: ['M3', 'P5', 'P8'], length: 20, tempo: 'normal' });
  });

  it('refuse une série vide ou de longueur invalide', () => {
    expect(() => createSeriesConfig([], 'asc')).toThrow();
    expect(() => createSeriesConfig(['M3'], 'asc', { length: 0 })).toThrow();
  });
});

describe('déroulé d’une série', () => {
  it('enchaîne question, réponse et feedback jusqu’à la fin', () => {
    const config = createSeriesConfig(['M3', 'P5', 'P8'], 'desc');
    const random = createRandom(3);
    let state = startSeries(config, random);
    expect(state.status).toBe('asking');
    expect(state.entries).toHaveLength(1);

    const { question } = currentEntry(state);
    state = answerCurrent(state, question.item, { responseTimeMs: 950.6, replays: 1 });
    expect(state.status).toBe('feedback');
    expect(currentEntry(state).result).toEqual({
      answer: question.item,
      correct: true,
      responseTimeMs: 951,
      replays: 1,
    });

    state = advance(state, random);
    expect(state.status).toBe('asking');
    expect(state.entries).toHaveLength(2);
  });

  it('s’arrête après le nombre de questions prévu', () => {
    const state = play(
      startSeries(createSeriesConfig(['m2', 'M2'], 'asc', { length: 5 }), createRandom(1)),
      2,
    );
    expect(state.status).toBe('finished');
    expect(state.entries).toHaveLength(5);
    expect(state.entries.every((entry) => entry.result !== null)).toBe(true);
  });

  it('refuse les actions hors de propos', () => {
    const state = startSeries(createSeriesConfig(['M3', 'P5'], 'asc'), createRandom(1));
    expect(() => advance(state, createRandom(1))).toThrow();
    expect(() => answerCurrent(state, 'P8', metrics)).toThrow();
    const answered = answerCurrent(state, 'M3', metrics);
    expect(() => answerCurrent(answered, 'M3', metrics)).toThrow();
  });

  it('ne reprend jamais la première note de la question précédente', () => {
    const state = play(
      startSeries(createSeriesConfig(['P5'], 'asc', { length: 50 }), createRandom(8)),
      9,
    );
    for (let i = 1; i < state.entries.length; i++) {
      expect(state.entries[i]?.question.midi[0]).not.toBe(state.entries[i - 1]?.question.midi[0]);
    }
  });
});

describe('seriesSummary', () => {
  it('compte les réussites, globalement et par intervalle', () => {
    const config = createSeriesConfig(['M3', 'P5', 'P8'], 'asc', { length: 30 });
    const state = play(startSeries(config, createRandom(4)), 5, ['P5']);
    const summary = seriesSummary(state);
    expect(summary.total).toBe(30);
    const p5 = summary.byItem.find((s) => s.item === 'P5');
    expect(p5?.correct).toBe(0);
    expect(summary.correct).toBe(30 - (p5?.total ?? 0));
    expect(summary.byItem.map((s) => s.item)).toEqual(['M3', 'P5', 'P8']);
    expect(summary.medianResponseTimeMs).toBe(1200);
  });
});
