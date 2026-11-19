// Libellés des éléments et des réponses, pour toutes les familles (§9.5).
import { parseInversionItem } from '../core/exercise/chordQuestion';
import type { FamilyId } from '../core/exercise/question';
import type { Presentation } from '../core/exercise/rendition';
import {
  CHORDS,
  INTERVALS,
  MODES,
  SCALES,
  type ChordQuality,
  type IntervalCode,
  type ModeCode,
  type ScaleCode,
} from '../core/theory';
import { capitalize, describeInterval, intervalName, presentationTitle } from './format';

export interface AnswerLabel {
  /** Sur le bouton, en grand : « 3M », « m7 », « 1er », « Dorien ». */
  short: string;
  /** Sous le libellé court : « Tierce majeure », « Mineur 7 », « mineur, 6M ». */
  name: string;
  /** Dans les listes serrées (colonnes du parcours), quand il diffère du libellé court. */
  compact?: string;
}

const SCALE_LABELS: Readonly<Record<ScaleCode, AnswerLabel>> = {
  major: { short: 'Majeure', name: 'Gamme majeure', compact: 'Maj' },
  natmin: { short: 'Mineure', name: 'Mineure naturelle', compact: 'm nat' },
  harmin: { short: 'Harmonique', name: 'Mineure harmonique', compact: 'm harm' },
  melmin: { short: 'Mélodique', name: 'Mineure mélodique', compact: 'm mél' },
  pentmaj: { short: 'Penta M', name: 'Pentatonique majeure', compact: 'penta M' },
  pentmin: { short: 'Penta m', name: 'Pentatonique mineure', compact: 'penta m' },
  blues: { short: 'Blues', name: 'Gamme blues', compact: 'blues' },
};

/** Modes : leur nom, et leur famille avec la note caractéristique (§6.3). */
const MODE_LABELS: Readonly<Record<ModeCode, AnswerLabel>> = {
  lydian: { short: 'Lydien', name: 'majeur, 4+', compact: 'lyd' },
  ionian: { short: 'Ionien', name: 'majeur', compact: 'ion' },
  mixolydian: { short: 'Mixolydien', name: 'majeur, 7m', compact: 'mixo' },
  dorian: { short: 'Dorien', name: 'mineur, 6M', compact: 'dor' },
  aeolian: { short: 'Éolien', name: 'mineur', compact: 'éol' },
  phrygian: { short: 'Phrygien', name: 'mineur, 2m', compact: 'phryg' },
  locrian: { short: 'Locrien', name: 'diminué, 2m 5−', compact: 'locr' },
};

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
  if (family === 'scl') return SCALE_LABELS[answer as ScaleCode];
  if (family === 'mod') return MODE_LABELS[answer as ModeCode];
  return INVERSION_LABELS[inversionIndex(answer)] as AnswerLabel;
}

const tokens = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Le libellé court n'est-il qu'une abréviation du nom (« 1er » → « 1er
 * renversement », « Penta m » → « Pentatonique mineure », « ° » → « Diminué ») ?
 * Le lecteur d'écran ne le lit alors pas deux fois.
 */
export function shortAbbreviatesName(label: AnswerLabel): boolean {
  const nameTokens = tokens(label.name);
  return tokens(label.short).every((short) => nameTokens.some((word) => word.startsWith(short)));
}

/**
 * Nom accessible d'un bouton de réponse, tiré de son texte visible (WCAG 2.5.3) :
 * « 3M Tierce majeure », « Dorien mineur, 6M », « Mineure harmonique ».
 */
export function answerAccessibleName(family: FamilyId, answer: string): string {
  const label = answerLabel(family, answer);
  return shortAbbreviatesName(label) ? label.name : `${label.short} ${label.name}`;
}
/** « Mode dorien », « Gamme mineure harmonique ». */
function scaleOrModeName(family: 'scl' | 'mod', code: string): string {
  return family === 'scl'
    ? `Gamme ${SCALES[code as ScaleCode].name}`
    : `Mode ${MODES[code as ModeCode].name}`;
}

const SCALE_PRESENTATIONS: Readonly<Record<string, string>> = {
  updown: 'montante et descendante',
  asc: 'montante',
  desc: 'descendante',
  drone: 'sur bourdon',
  plain: 'sans bourdon',
  melody: 'en mélodie',
};

/** Nom complet d'un accord : « Accord parfait majeur ». */
export function chordName(quality: ChordQuality): string {
  return capitalize(CHORDS[quality].name);
}

/** Libellé court d'un élément, pour les listes : « 3M », « m7 », « M 1er », « dor ». */
export function itemShort(family: FamilyId, item: string): string {
  if (family !== 'inv') {
    const label = answerLabel(family, item);
    return label.compact ?? label.short;
  }
  const parsed = parseInversionItem(item);
  if (!parsed) return item;
  return `${CHORD_LABELS[parsed.quality].short} ${INVERSION_LABELS[parsed.inversion]?.short ?? ''}`;
}

/** Nom d'un élément : « Tierce majeure (3M) », « Accord parfait mineur (m) ». */
export function itemLabel(family: FamilyId, item: string): string {
  if (family === 'int') return `${intervalName(item as IntervalCode)} (${itemShort('int', item)})`;
  if (family === 'chd') return `${chordName(item as ChordQuality)} (${itemShort('chd', item)})`;
  if (family === 'scl') return scaleOrModeName('scl', item);
  if (family === 'mod')
    return `${scaleOrModeName('mod', item)} (${MODE_LABELS[item as ModeCode].name})`;
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
  if (family === 'scl' || family === 'mod') {
    return `${scaleOrModeName(family, item)} (${SCALE_PRESENTATIONS[presentation] ?? presentation})`;
  }
  return itemLabel('inv', item);
}

/** Titre d'un contexte de réponse : « Intervalles ascendants », « Accords plaqués ». */
export function contextTitle(family: FamilyId, presentation: Presentation): string {
  if (family === 'int') return presentationTitle(presentation as 'asc');
  if (family === 'inv') return 'Renversements';
  const titles: Readonly<Record<string, string>> = {
    arp: 'Accords arpégés',
    block: 'Accords plaqués',
    inv: 'Accords renversés',
    updown: 'Gammes montantes et descendantes',
    asc: 'Gammes montantes',
    desc: 'Gammes descendantes',
    drone: 'Modes sur bourdon',
    plain: 'Modes sans bourdon',
    melody: 'Mélodies modales',
  };
  return titles[presentation] ?? presentation;
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
  if (family === 'scl') return `une gamme ${SCALES[answer as ScaleCode].name}`;
  if (family === 'mod') {
    const reference = { ionian: ' (majeur)', aeolian: ' (mineur naturel)' }[answer as string] ?? '';
    return `le mode ${MODES[answer as ModeCode].name}${reference}`;
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
  if (family === 'scl' || family === 'mod') return scaleOrModeName(family, item);
  return itemLabel('inv', item);
}
