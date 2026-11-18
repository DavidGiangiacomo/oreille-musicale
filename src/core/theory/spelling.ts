import { accidentalsOf, type NoteName } from './notes';

/**
 * Orthographes retenues pour une fondamentale ou une tonique, par classe de
 * hauteur. On écarte Mi♯, Fa♭, Si♯ et Do♭. À nombre d'altérations égal, la
 * première orthographe de la liste l'emporte (Ré♭ plutôt que Do♯, Fa♯ plutôt que Sol♭).
 */
export const ROOT_SPELLINGS: readonly (readonly string[])[] = [
  ['C'],
  ['Db', 'C#'],
  ['D'],
  ['Eb', 'D#'],
  ['E'],
  ['F'],
  ['F#', 'Gb'],
  ['G'],
  ['Ab', 'G#'],
  ['A'],
  ['Bb', 'A#'],
  ['B'],
];

/** Orthographes possibles d'une hauteur MIDI : `spellingsOf(61)` donne `['Db4', 'C#4']`. */
export function spellingsOf(midi: number): NoteName[] {
  if (!Number.isInteger(midi)) throw new Error(`Hauteur MIDI invalide : ${midi}`);
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const candidates = ROOT_SPELLINGS[pitchClass] ?? [];
  return candidates.map((pc) => pc + String(octave));
}

/** Nombre total d'altérations d'un ensemble de notes. */
export function accidentalCount(notes: readonly NoteName[]): number {
  return notes.reduce((sum, note) => sum + accidentalsOf(note), 0);
}

export function hasDoubleAccidental(notes: readonly NoteName[]): boolean {
  return notes.some((note) => accidentalsOf(note) >= 2);
}

/**
 * Retient le candidat dont les notes portent le moins d'altérations ; à égalité,
 * le premier de la liste. Sert à choisir entre Do♯ et Ré♭, ou entre 4+ et 5−.
 */
export function chooseSpelling<T>(
  candidates: readonly T[],
  notesOf: (candidate: T) => readonly NoteName[],
): T {
  let best: T | undefined;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const notes = notesOf(candidate);
    const score = accidentalCount(notes) + (hasDoubleAccidental(notes) ? 100 : 0);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  if (best === undefined) throw new Error('Aucune orthographe candidate');
  return best;
}
