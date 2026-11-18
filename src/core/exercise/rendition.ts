// Réalisation d'une question : la liste des notes à jouer, produite par le cœur
// métier et jouée telle quelle par le moteur audio (docs/DESIGN.md §6.5 et §10.4).

export type InstrumentId = 'piano' | 'pure';

export type Tempo = 'slow' | 'normal' | 'fast';

/** Facteur appliqué aux durées : le tempo lent les allonge, le rapide les raccourcit. */
export const TEMPO_FACTORS: Readonly<Record<Tempo, number>> = {
  slow: 1.4,
  normal: 1,
  fast: 0.7,
};

/** Une note à jouer. Les temps sont en secondes, relatifs au début de la réalisation. */
export interface NoteEvent {
  midi: number;
  start: number;
  duration: number;
  /** Intensité, de 0 à 1. */
  velocity: number;
  /** Instrument de cette note ; par défaut, celui de la séance. */
  instrument?: InstrumentId;
}

export type IntervalPresentation = 'asc' | 'desc' | 'harm';

export const DEFAULT_VELOCITY = 0.7;

/** Durées au tempo normal (§6.5). */
export const DURATIONS = {
  melodicNote: 0.9,
  melodicGap: 0.1,
  harmonicNote: 1.8,
} as const;

/**
 * Notes d'un intervalle. En mélodique, `first` est jouée puis `second` ; en
 * harmonique, les deux sonnent ensemble.
 */
export function intervalEvents(
  first: number,
  second: number,
  presentation: IntervalPresentation,
  tempo: Tempo = 'normal',
): NoteEvent[] {
  const factor = TEMPO_FACTORS[tempo];
  if (presentation === 'harm') {
    const duration = DURATIONS.harmonicNote * factor;
    return [first, second].map((midi) => ({
      midi,
      start: 0,
      duration,
      velocity: DEFAULT_VELOCITY,
    }));
  }
  const duration = DURATIONS.melodicNote * factor;
  return [
    { midi: first, start: 0, duration, velocity: DEFAULT_VELOCITY },
    {
      midi: second,
      start: (DURATIONS.melodicNote + DURATIONS.melodicGap) * factor,
      duration,
      velocity: DEFAULT_VELOCITY,
    },
  ];
}

/** Fin de la dernière note d'une réalisation, en secondes. */
export function renditionDuration(events: readonly NoteEvent[]): number {
  return events.reduce((end, event) => Math.max(end, event.start + event.duration), 0);
}
