// Journal (docs/DESIGN.md §10.5) : la source de vérité, en ajout seul. Les états
// (progression, révisions, statistiques) en seront des projections recalculables.
import type { StepPhase, TrackId } from './curriculum';
import type { CompetenceId } from './exercise/competence';
import type { InstrumentId, Presentation, Tempo } from './exercise/rendition';
import { DAILY_GOAL_CHOICES, DEFAULT_DAILY_GOAL_MINUTES } from './progress/activity';
import type { AnsweredQuestion, SeriesConfig } from './session/series';
import type { NoteNaming, OctaveConvention } from './theory';

export type { Presentation } from './exercise/rendition';

export interface SessionRecord {
  id: string;
  /** Séance du jour, entraînement libre ou travail sur une étape du parcours. */
  kind: 'daily' | 'custom' | 'step';
  /** Horodatage en millisecondes. */
  startedAt: number;
  endedAt?: number;
  appVersion: string;
  curriculumVersion: string;
  /** Réglages d'une série d'entraînement libre. */
  config?: { presentation: Presentation; items: string[]; length: number };
  /** Étape travaillée, pour une séance d'étape. */
  stepId?: string;
}

/**
 * Événements de progression : changements de phase et résultats des tests
 * d'étape. Avec les réponses, ils suffisent à recalculer toute la progression.
 */
export type ProgressEvent =
  | { id: string; at: number; type: 'phase_started'; stepId: string; phase: StepPhase }
  | {
      id: string;
      at: number;
      type: 'step_validated';
      stepId: string;
      /** Réussite au test, de 0 à 1. */
      score: number;
      /** Compétences introduites par l'étape, qui entrent en révision. */
      competenceIds: CompetenceId[];
    }
  | { id: string; at: number; type: 'test_failed'; stepId: string; score: number };

export type Activity = 'contrast' | 'train' | 'test' | 'review' | 'duel' | 'free' | 'placement';

/**
 * Réponse donnée. Union discriminée par `type` : la réponse chantée de la v2
 * (`{ type: 'sung'; notes: … }`, §11) s'y ajoutera sans migration.
 */
export type AnswerPayload = { type: 'choice'; value: string };

export interface Attempt {
  id: string;
  sessionId: string;
  at: number;
  activity: Activity;
  stepId?: string;
  /** Ce qui a été joué. */
  competenceId: CompetenceId;
  rendition: {
    midi: number[];
    spelling: string[];
    presentation: Presentation;
    instrument: InstrumentId;
    tempo: Tempo;
  };
  /** Réponses proposées, pour une réponse par boutons. */
  choices?: string[];
  answer: AnswerPayload;
  correct: boolean;
  responseTimeMs: number;
  replays: number;
  /** Aide utilisée (« écouter arpégé »…). */
  helpUsed: boolean;
}

/** Tentative du journal à partir d'une question répondue (série, étape, séance). */
export function attemptFromEntry(
  entry: AnsweredQuestion,
  context: {
    id: string;
    sessionId: string;
    at: number;
    instrument: InstrumentId;
    /** Activité : entraînement libre par défaut. */
    activity?: Activity;
    stepId?: string;
  },
): Attempt {
  const { question, result } = entry;
  if (!result) throw new Error('Question sans réponse : rien à enregistrer');
  return {
    id: context.id,
    sessionId: context.sessionId,
    at: context.at,
    activity: context.activity ?? 'free',
    ...(context.stepId === undefined ? {} : { stepId: context.stepId }),
    competenceId: question.competenceId,
    rendition: {
      midi: [...question.midi],
      spelling: [...question.notes],
      presentation: question.presentation,
      instrument: context.instrument,
      tempo: question.tempo,
    },
    choices: [...question.choices],
    answer: { type: 'choice', value: result.answer },
    correct: result.correct,
    responseTimeMs: result.responseTimeMs,
    replays: result.replays,
    helpUsed: result.helpUsed,
  };
}

export function sessionConfigOf(config: SeriesConfig): SessionRecord['config'] {
  return { presentation: config.presentation, items: [...config.items], length: config.length };
}

export interface Settings {
  noteNames: NoteNaming;
  octaveConvention: OctaveConvention;
  instrument: InstrumentId;
  tempo: Tempo;
  /** Volume général, de 0 à 1. */
  volume: number;
  /** Passer seul à la question suivante après une bonne réponse. */
  autoAdvance: boolean;
  /** Parcours proposés par la séance du jour et l'accueil. */
  activeTracks: TrackId[];
  /** Objectif quotidien, en minutes de pratique active (§9.4). */
  dailyGoalMinutes: number;
  /** Premier lancement terminé (test audio, notation). */
  onboardingDone: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  noteNames: 'fr',
  octaveConvention: 'fr',
  instrument: 'piano',
  tempo: 'normal',
  volume: 1,
  autoAdvance: true,
  activeTracks: ['intervals', 'triads'],
  dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
  onboardingDone: false,
};

const KNOWN_TRACKS: readonly TrackId[] = [
  'intervals',
  'triads',
  'sevenths',
  'inversions',
  'scales',
  'modes',
];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Réglages lus du stockage : les valeurs absentes ou invalides reprennent leur
 * valeur par défaut, ce qui permet d'ajouter des réglages sans migration.
 */
export function normalizeSettings(stored: unknown): Settings {
  const raw = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_SETTINGS;
  const volume = typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1;
  const activeTracks = Array.isArray(raw.activeTracks)
    ? KNOWN_TRACKS.filter((track) => (raw.activeTracks as unknown[]).includes(track))
    : [];
  return {
    noteNames: oneOf(raw.noteNames, ['fr', 'en'], d.noteNames),
    octaveConvention: oneOf(raw.octaveConvention, ['fr', 'scientific'], d.octaveConvention),
    instrument: oneOf(raw.instrument, ['piano', 'pure'], d.instrument),
    tempo: oneOf(raw.tempo, ['slow', 'normal', 'fast'], d.tempo),
    volume: volume ? (raw.volume as number) : d.volume,
    autoAdvance: typeof raw.autoAdvance === 'boolean' ? raw.autoAdvance : d.autoAdvance,
    activeTracks: activeTracks.length > 0 ? activeTracks : [...d.activeTracks],
    dailyGoalMinutes: (DAILY_GOAL_CHOICES as readonly unknown[]).includes(raw.dailyGoalMinutes)
      ? (raw.dailyGoalMinutes as number)
      : d.dailyGoalMinutes,
    onboardingDone: raw.onboardingDone === true,
  };
}
