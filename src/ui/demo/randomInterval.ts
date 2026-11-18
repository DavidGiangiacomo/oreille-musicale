import {
  intervalEvents,
  type IntervalPresentation,
  type NoteEvent,
} from '../../core/exercise/rendition';
import {
  INTERVAL_CODES,
  INTERVALS,
  midiOf,
  spellInterval,
  type IntervalCode,
  type NoteName,
} from '../../core/theory';

/**
 * Tirage d'un intervalle pour la démonstration du jalon J0. La génération des
 * questions d'exercice, avec graine et tirage pondéré, arrive avec J1 (#17).
 */
export interface DemoInterval {
  code: IntervalCode;
  presentation: IntervalPresentation;
  /** Notes dans l'ordre où on les entend (la plus grave d'abord en harmonique). */
  notes: [NoteName, NoteName];
  events: NoteEvent[];
}

/** Registre des premières étapes : F3 à F5 (§6.5). */
const LOW = 53;
const HIGH = 77;
const PRESENTATIONS: readonly IntervalPresentation[] = ['asc', 'desc', 'harm'];

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('Liste vide');
  return item;
}

export function randomInterval(
  previousFirstMidi: number | null,
  random: () => number = Math.random,
): DemoInterval {
  const code = pick(INTERVAL_CODES, random);
  const presentation = pick(PRESENTATIONS, random);
  const semitones = INTERVALS[code].semitones;
  const [min, max] = presentation === 'desc' ? [LOW + semitones, HIGH] : [LOW, HIGH - semitones];
  let first = min + Math.floor(random() * (max - min + 1));
  if (first === previousFirstMidi) first = first === max ? min : first + 1;
  const notes = spellInterval(first, code, presentation === 'desc' ? 'down' : 'up');
  return {
    code,
    presentation,
    notes,
    events: intervalEvents(midiOf(notes[0]), midiOf(notes[1]), presentation),
  };
}

/** « Tierce mineure ascendante », « Triton harmonique »… */
export function describeInterval(code: IntervalCode, presentation: IntervalPresentation): string {
  const masculine = code === 'TT';
  const qualifier = {
    asc: masculine ? 'ascendant' : 'ascendante',
    desc: masculine ? 'descendant' : 'descendante',
    harm: 'harmonique',
  }[presentation];
  const name = INTERVALS[code].name;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${qualifier}`;
}
