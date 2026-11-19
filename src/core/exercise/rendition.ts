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

/** Accords : arpégé montant, plaqué à l'état fondamental, plaqué renversé (§6.4). */
export type ChordPresentation = 'arp' | 'block' | 'inv';

/** Façon de faire entendre un élément ; s'étendra aux gammes et aux modes. */
export type Presentation = IntervalPresentation | ChordPresentation;

export const DEFAULT_VELOCITY = 0.7;

/** Durées au tempo normal (§6.5). */
export const DURATIONS = {
  melodicNote: 0.9,
  melodicGap: 0.1,
  harmonicNote: 1.8,
  blockChord: 2,
  arpeggioStep: 0.45,
  /** Tenue de toutes les notes après la dernière note d'un arpège. */
  arpeggioHold: 1.5,
} as const;

/** Les notes d'un accord, plus nombreuses, sont jouées un peu moins fort. */
export const CHORD_VELOCITY = 0.6;

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

/**
 * Notes d'un accord, de la basse à la note la plus aiguë : plaquées (2 s), ou
 * arpégées en montant (0,45 s entre les notes, toutes tenues jusqu'à la fin).
 */
export function chordEvents(
  midi: readonly number[],
  arpeggiated: boolean,
  tempo: Tempo = 'normal',
): NoteEvent[] {
  const factor = TEMPO_FACTORS[tempo];
  if (!arpeggiated) {
    return midi.map((note) => ({
      midi: note,
      start: 0,
      duration: DURATIONS.blockChord * factor,
      velocity: CHORD_VELOCITY,
    }));
  }
  const step = DURATIONS.arpeggioStep * factor;
  const end = (midi.length - 1) * step + DURATIONS.arpeggioHold * factor;
  return midi.map((note, i) => ({
    midi: note,
    start: i * step,
    duration: end - i * step,
    velocity: CHORD_VELOCITY,
  }));
}

/** Fin de la dernière note d'une réalisation, en secondes. */
export function renditionDuration(events: readonly NoteEvent[]): number {
  return events.reduce((end, event) => Math.max(end, event.start + event.duration), 0);
}
