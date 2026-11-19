import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stepsOfTrack } from '../curriculum';
import type { Attempt, ProgressEvent } from '../journal';
import { applyReview, enterReview } from '../srs';
import { currentStep, projectCompetences, projectSteps } from './projection';

const steps = stepsOfTrack('intervals');
let counter = 0;

const started = (
  stepId: string,
  at: number,
  phase: 'discover' | 'contrast' | 'train' | 'test' = 'discover',
): ProgressEvent => ({
  id: `e${++counter}`,
  at,
  type: 'phase_started',
  stepId,
  phase,
});
const validated = (stepId: string, at: number, score = 0.95): ProgressEvent => ({
  id: `e${++counter}`,
  at,
  type: 'step_validated',
  stepId,
  score,
  competenceIds: [],
});
const failed = (stepId: string, at: number, score: number): ProgressEvent => ({
  id: `e${++counter}`,
  at,
  type: 'test_failed',
  stepId,
  score,
});
const attempt = (
  competenceId: string,
  at: number,
  correct: boolean,
  responseTimeMs = 1000,
): Attempt => ({
  id: `a${++counter}`,
  sessionId: 's',
  at,
  activity: 'train',
  competenceId,
  rendition: {
    midi: [60, 64],
    spelling: ['C4', 'E4'],
    presentation: 'asc',
    instrument: 'piano',
    tempo: 'normal',
  },
  answer: { type: 'choice', value: 'M3' },
  correct,
  responseTimeMs,
  replays: 0,
  helpUsed: false,
});

describe('projectSteps', () => {
  it('ouvre seulement la première étape au départ', () => {
    const states = projectSteps(steps, []);
    expect(states.get('int.asc.01')).toMatchObject({ status: 'available', phase: null });
    expect([...states.values()].filter((s) => s.status !== 'locked')).toHaveLength(1);
  });

  it('suit les phases puis débloque les étapes de droite et du dessous', () => {
    const events = [started('int.asc.01', 1), started('int.asc.01', 2, 'train')];
    expect(projectSteps(steps, events).get('int.asc.01')).toMatchObject({
      status: 'in_progress',
      phase: 'train',
      lastActivityAt: 2,
    });
    const after = projectSteps(steps, [
      ...events,
      failed('int.asc.01', 3, 0.8),
      validated('int.asc.01', 4, 0.92),
    ]);
    expect(after.get('int.asc.01')).toMatchObject({
      status: 'validated',
      phase: null,
      bestScore: 0.92,
      validatedAt: 4,
    });
    expect(after.get('int.asc.02')?.status).toBe('available');
    expect(after.get('int.desc.01')?.status).toBe('available');
    expect(after.get('int.desc.02')?.status).toBe('locked');
  });

  it('exige les deux prérequis d’une étape intérieure', () => {
    const events = ['int.asc.01', 'int.asc.02', 'int.desc.01'].map((id, i) => validated(id, i));
    expect(projectSteps(steps, events).get('int.desc.02')?.status).toBe('available');
    expect(projectSteps(steps, events.slice(0, 2)).get('int.desc.02')?.status).toBe('locked');
  });

  it('donne le même état quel que soit l’ordre de lecture du journal', () => {
    const events = [
      started('int.asc.01', 1),
      validated('int.asc.01', 5),
      started('int.asc.02', 6),
      started('int.asc.02', 7, 'contrast'),
      failed('int.asc.02', 9, 0.7),
      started('int.desc.01', 8),
    ];
    const reference = projectSteps(steps, events);
    fc.assert(
      fc.property(fc.shuffledSubarray(events, { minLength: events.length }), (shuffled) => {
        expect(projectSteps(steps, shuffled)).toEqual(reference);
      }),
    );
    expect(projectSteps(steps, events)).toEqual(reference);
  });

  it('ignore les événements d’étapes inconnues', () => {
    expect(projectSteps(steps, [validated('int.xyz.01', 1)])).toEqual(projectSteps(steps, []));
  });
});

describe('currentStep', () => {
  it('reprend l’étape en cours la plus récente, sinon la première disponible', () => {
    expect(currentStep(steps, projectSteps(steps, []))?.id).toBe('int.asc.01');
    const events = [
      validated('int.asc.01', 1),
      started('int.desc.01', 2),
      started('int.asc.02', 3),
    ];
    expect(currentStep(steps, projectSteps(steps, events))?.id).toBe('int.asc.02');
    const onlyAvailable = [validated('int.asc.01', 1)];
    expect(currentStep(steps, projectSteps(steps, onlyAvailable))?.id).toBe('int.asc.02');
    const all = steps.map((step, i) => validated(step.id, i));
    expect(currentStep(steps, projectSteps(steps, all))).toBeNull();
  });
});

describe('projectCompetences', () => {
  it('donne le niveau, la date d’introduction et les statistiques', () => {
    const events = [
      started('int.asc.01', 10),
      validated('int.asc.01', 20),
      started('int.asc.02', 30),
    ];
    const attempts = [
      attempt('int:M3:asc', 11, true, 800),
      attempt('int:M3:asc', 12, false, 3000),
      attempt('int:M3:asc', 13, true, 1200),
      attempt('int:P4:asc', 31, true),
    ];
    const competences = projectCompetences(steps, projectSteps(steps, events), events, attempts);
    expect(competences.get('int:M3:asc')).toMatchObject({
      level: 2,
      introducedAt: 10,
      attempts: 3,
      recent: [true, false, true],
      fragile: false,
      medianResponseTimeMs: 1000,
    });
    expect(competences.get('int:P4:asc')).toMatchObject({
      level: 1,
      introducedAt: 30,
      attempts: 1,
    });
    expect(competences.get('int:m3:asc')).toMatchObject({
      level: 0,
      introducedAt: null,
      attempts: 0,
    });
    expect(competences.size).toBe(36);
  });

  it('marque fragile une compétence acquise qui faiblit', () => {
    const events = [started('int.asc.01', 1), validated('int.asc.01', 2)];
    const answers = [true, false, false, true, false, false].map((ok, i) =>
      attempt('int:P5:asc', 10 + i, ok),
    );
    const competences = projectCompetences(steps, projectSteps(steps, events), events, answers);
    expect(competences.get('int:P5:asc')?.fragile).toBe(true);
    expect(competences.get('int:P8:asc')?.fragile).toBe(false);
  });

  it('monte aux niveaux 3 et 4 selon la stabilité, et marque fragile après un oubli', () => {
    const events = [started('int.asc.01', 1), validated('int.asc.01', 2)];
    const entered = enterReview('int:M3:asc', 2, 3);
    const reviews = new Map([
      ['int:M3:asc', entered],
      ['int:P5:asc', { ...entered, competenceId: 'int:P5:asc', stability: 12 }],
      ['int:P8:asc', { ...entered, competenceId: 'int:P8:asc', stability: 45 }],
    ]);
    const levels = (map: typeof reviews) => {
      const competences = projectCompetences(steps, projectSteps(steps, events), events, [], map);
      return ['int:M3:asc', 'int:P5:asc', 'int:P8:asc'].map((id) => competences.get(id));
    };
    expect(levels(reviews).map((c) => c?.level)).toEqual([2, 3, 4]);
    expect(levels(reviews)[0]?.review).toBe(entered);
    reviews.set('int:M3:asc', applyReview(entered, 3 * 86_400_000, 1));
    expect(levels(reviews)[0]?.fragile).toBe(true);
  });
});
