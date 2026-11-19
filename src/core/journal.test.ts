import { describe, expect, it } from 'vitest';
import { attemptFromEntry, DEFAULT_SETTINGS, normalizeSettings, sessionConfigOf } from './journal';
import { createRandom } from './random';
import { answerCurrent, createSeriesConfig, currentEntry, startSeries } from './session/series';

describe('attemptFromEntry', () => {
  it('transforme une question répondue en tentative du journal', () => {
    const state = startSeries(createSeriesConfig(['M3', 'P5'], 'harm'), createRandom(1));
    const { question } = currentEntry(state);
    const wrong = question.item === 'M3' ? 'P5' : 'M3';
    const answered = answerCurrent(state, wrong, { responseTimeMs: 800, replays: 2 });
    const attempt = attemptFromEntry(currentEntry(answered), {
      id: 'a1',
      sessionId: 's1',
      at: 1000,
      instrument: 'pure',
    });
    expect(attempt).toEqual({
      id: 'a1',
      sessionId: 's1',
      at: 1000,
      activity: 'free',
      competenceId: `int:${question.item}:harm`,
      rendition: {
        midi: question.midi,
        spelling: question.notes,
        presentation: 'harm',
        instrument: 'pure',
        tempo: 'normal',
      },
      choices: ['M3', 'P5'],
      answer: { type: 'choice', value: wrong },
      correct: false,
      responseTimeMs: 800,
      replays: 2,
      helpUsed: false,
    });
  });

  it('rattache une réponse à son étape et à sa phase', () => {
    const state = startSeries(createSeriesConfig(['M3'], 'asc'), createRandom(1));
    const answered = answerCurrent(state, 'M3', { responseTimeMs: 500, replays: 0 });
    const attempt = attemptFromEntry(currentEntry(answered), {
      id: 'a',
      sessionId: 's',
      at: 1,
      instrument: 'piano',
      activity: 'test',
      stepId: 'int.asc.01',
    });
    expect(attempt).toMatchObject({ activity: 'test', stepId: 'int.asc.01', correct: true });
  });

  it('refuse une question sans réponse', () => {
    const state = startSeries(createSeriesConfig(['M3'], 'asc'), createRandom(1));
    expect(() =>
      attemptFromEntry(currentEntry(state), {
        id: 'a',
        sessionId: 's',
        at: 0,
        instrument: 'piano',
      }),
    ).toThrow();
  });

  it('résume la configuration d’une série pour la séance', () => {
    expect(sessionConfigOf(createSeriesConfig(['P8', 'M3'], 'desc', { length: 10 }))).toEqual({
      presentation: 'desc',
      items: ['M3', 'P8'],
      length: 10,
    });
  });
});

describe('normalizeSettings', () => {
  it('donne les réglages par défaut sans données', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('n’importe quoi')).toEqual(DEFAULT_SETTINGS);
  });

  it('garde les parcours actifs connus et l’état du premier lancement', () => {
    expect(
      normalizeSettings({ activeTracks: ['intervals', 'inconnu'], onboardingDone: true }),
    ).toMatchObject({
      activeTracks: ['intervals'],
      onboardingDone: true,
    });
    expect(normalizeSettings({ activeTracks: [] }).activeTracks).toEqual(['intervals']);
    expect(normalizeSettings({ onboardingDone: 'oui' }).onboardingDone).toBe(false);
  });

  it('accepte un objectif quotidien parmi les durées proposées', () => {
    expect(normalizeSettings({ dailyGoalMinutes: 20 }).dailyGoalMinutes).toBe(20);
    expect(normalizeSettings({ dailyGoalMinutes: 7 }).dailyGoalMinutes).toBe(10);
    expect(normalizeSettings({ dailyGoalMinutes: '15' }).dailyGoalMinutes).toBe(10);
  });

  it('garde les valeurs valides et remplace les autres', () => {
    expect(
      normalizeSettings({
        noteNames: 'en',
        octaveConvention: 'martien',
        instrument: 'pure',
        volume: 4,
        autoAdvance: false,
        reglageFutur: 12,
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      noteNames: 'en',
      instrument: 'pure',
      autoAdvance: false,
    });
  });
});
