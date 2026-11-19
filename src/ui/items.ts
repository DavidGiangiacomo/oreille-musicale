// Libellés des éléments et des réponses, pour les trois familles (§9.5).
import { parseInversionItem } from '../core/exercise/chordQuestion';
import type { FamilyId } from '../core/exercise/question';
import type { Presentation } from '../core/exercise/rendition';
import { CHORDS, INTERVALS, type ChordQuality, type IntervalCode } from '../core/theory';
import { capitalize, describeInterval, intervalName, presentationTitle } from './format';

export interface AnswerLabel {
  /** Sur le bouton, en grand : « 3M », « m7 », « 1er ». */
  short: string;
  /** Sous le libellé court : « Tierce majeure », « Mineur 7 », « 1er renversement ». */
  name: string;
}

const CHORD_LABELS: Readonly<Record<ChordQuality, AnswerLabel>> = {
  maj: { short: 'M', name: 'Majeur' },
  min: { short: 'm', name: 'Mineur' },
  dim: { short: '°', name: 'Diminué' },
  aug: { short: '+', name: 'Augmenté' },
  sus4: { short: 'sus4', name: 'Suspendu 4' },
  sus2: { short: 'sus2', name: 'Suspendu 2' },
  dom7: { short: '7', name: '7 de dominante' },
  maj7: { short: '7M', name: '7 majeure' },
  m7: { short: 'm7', name: 'Mineur 7' },
  m7b5: { short: 'ø', name: 'Demi-diminué' },
  dim7: { short: '°7', name: '7 diminuée' },
  mmaj7: { short: 'm7M', name: 'Mineur 7M' },
  '7sus4': { short: '7sus4', name: '7 suspendue' },
};

const INVERSION_LABELS: readonly AnswerLabel[] = [
  { short: 'Fond.', name: 'État fondamental' },
  { short: '1er', name: '1er renversement' },
  { short: '2e', name: '2e renversement' },
  { short: '3e', name: '3e renversement' },
];

function inversionIndex(answer: string): number {
  return Number(answer.replace('inv', ''));
}

/** Libellé d'une réponse, sur son bouton. */
export function answerLabel(family: FamilyId, answer: string): AnswerLabel {
  if (family === 'int') {
    const code = answer as IntervalCode;
    return { short: INTERVALS[code].abbreviation, name: intervalName(code) };
  }
  if (family === 'chd') return CHORD_LABELS[answer as ChordQuality];
  return INVERSION_LABELS[inversionIndex(answer)] as AnswerLabel;
}

/** Nom accessible d'un bouton de réponse : « Tierce majeure (3M) ». */
export function answerAccessibleName(family: FamilyId, answer: string): string {
  const { short, name } = answerLabel(family, answer);
  return family === 'inv' ? name : `${name} (${short})`;
}

/** Nom complet d'un accord : « Accord parfait majeur ». */
export function chordName(quality: ChordQuality): string {
  return capitalize(CHORDS[quality].name);
}

/** Libellé court d'un élément, pour les listes : « 3M », « m7 », « M 1er ». */
export function itemShort(family: FamilyId, item: string): string {
  if (family !== 'inv') return answerLabel(family, item).short;
  const parsed = parseInversionItem(item);
  if (!parsed) return item;
  return `${CHORD_LABELS[parsed.quality].short} ${INVERSION_LABELS[parsed.inversion]?.short ?? ''}`;
}

/** Nom d'un élément : « Tierce majeure (3M) », « Accord parfait mineur (m) ». */
export function itemLabel(family: FamilyId, item: string): string {
  if (family === 'int') return answerAccessibleName('int', item);
  if (family === 'chd') return `${chordName(item as ChordQuality)} (${itemShort('chd', item)})`;
  const parsed = parseInversionItem(item);
  if (!parsed) return item;
  return `${chordName(parsed.quality)}, ${INVERSION_LABELS[parsed.inversion]?.name.toLowerCase()}`;
}

const CHORD_PRESENTATIONS: Readonly<Record<string, string>> = {
  arp: 'arpégé',
  block: 'plaqué',
  inv: 'renversé',
};

/**
 * Une compétence : « Tierce majeure ascendante », « Accord parfait mineur (arpégé) »,
 * « Septième de dominante, 2e renversement ».
 */
export function itemDescription(
  family: FamilyId,
  item: string,
  presentation: Presentation,
): string {
  if (family === 'int') return describeInterval(item as IntervalCode, presentation as 'asc');
  if (family === 'chd') {
    return `${chordName(item as ChordQuality)} (${CHORD_PRESENTATIONS[presentation] ?? presentation})`;
  }
  return itemLabel('inv', item);
}

/** Titre d'un contexte de réponse : « Intervalles ascendants », « Accords plaqués ». */
export function contextTitle(family: FamilyId, presentation: Presentation): string {
  if (family === 'int') return presentationTitle(presentation as 'asc');
  if (family === 'inv') return 'Renversements';
  return { arp: 'Accords arpégés', block: 'Accords plaqués', inv: 'Accords renversés' }[
    presentation as 'arp'
  ];
}

/** « une tierce majeure », « un accord parfait mineur », « le 1er renversement ». */
export function answerWithArticle(family: FamilyId, answer: string): string {
  if (family === 'int') {
    return `${answer === 'TT' ? 'un' : 'une'} ${INTERVALS[answer as IntervalCode].name}`;
  }
  if (family === 'chd') {
    const name = CHORDS[answer as ChordQuality].name;
    return `${name.startsWith('septième') ? 'une' : 'un'} ${name}`;
  }
  return inversionIndex(answer) === 0
    ? 'l’état fondamental'
    : `le ${INVERSION_LABELS[inversionIndex(answer)]?.name}`;
}

/** Liste courte de réponses : « 3M, 5J, 8J », « M, m, ° ». */
export function answersList(family: FamilyId, answers: readonly string[]): string {
  return answers.map((answer) => answerLabel(family, answer).short).join(', ');
}

/** Nom d'un élément, sans abréviation : « Tierce majeure », « Accord parfait mineur ». */
export function itemName(family: FamilyId, item: string): string {
  if (family === 'int') return intervalName(item as IntervalCode);
  if (family === 'chd') return chordName(item as ChordQuality);
  return itemLabel('inv', item);
}
