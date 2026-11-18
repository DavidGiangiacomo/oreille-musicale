// Raccourcis clavier de l'écran d'exercice (§9.2). Les touches sont reconnues par
// leur position physique (`KeyboardEvent.code`) : la rangée des chiffres fonctionne
// ainsi en AZERTY sans appuyer sur Maj.

const ROW_CODES = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
  'Minus',
  'Equal',
] as const;

const NUMPAD_CODES = [
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'Numpad0',
] as const;

/** Rang de la réponse associée à une touche, ou null. */
export function answerIndexForCode(code: string): number | null {
  const row = ROW_CODES.indexOf(code as (typeof ROW_CODES)[number]);
  if (row >= 0) return row;
  const numpad = NUMPAD_CODES.indexOf(code as (typeof NUMPAD_CODES)[number]);
  return numpad >= 0 ? numpad : null;
}

/** Libellé de la touche d'une réponse : « 1 » à « 9 », « 0 », puis les deux touches suivantes. */
export function keyHint(index: number, layout?: ReadonlyMap<string, string>): string | null {
  const code = ROW_CODES[index];
  if (!code) return null;
  if (index < 10) return String((index + 1) % 10);
  return layout?.get(code) ?? (code === 'Minus' ? '-' : '=');
}
