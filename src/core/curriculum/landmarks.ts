// Chansons repères des intervalles (docs/DESIGN.md §6.1) : des airs connus dont les deux
// premières notes forment l'intervalle, sauf précision. Ce sont des aide-mémoire, rangés
// du plus cité au moins cité ; l'utilisateur peut les remplacer par le sien, les plus
// efficaces étant des airs qu'il connaît bien. Un sens reste vide quand aucun air n'est sûr.
import type { IntervalCode } from '../theory';

export type LandmarkDirection = 'asc' | 'desc';

export const INTERVAL_LANDMARKS: Readonly<
  Record<IntervalCode, Readonly<Record<LandmarkDirection, readonly string[]>>>
> = {
  m2: {
    asc: [
      'Les Dents de la mer (thème)',
      'La Panthère rose (thème)',
      'White Christmas (« I’m drea-ming »)',
    ],
    desc: ['La Lettre à Élise (Beethoven)', 'Joy to the World', 'Fly Me to the Moon'],
  },
  M2: {
    asc: [
      'Frère Jacques',
      'Douce nuit (« Dou-ce »)',
      'Joyeux anniversaire (« -eux an- »)',
      'Au clair de la lune, après les trois do',
    ],
    desc: ['Yesterday (Beatles)', 'Mary Had a Little Lamb', 'Three Blind Mice'],
  },
  m3: {
    asc: [
      'Greensleeves',
      'Seven Nation Army (White Stripes)',
      'Smoke on the Water (Deep Purple)',
      'Berceuse (Brahms)',
    ],
    desc: [
      'Hey Jude (Beatles)',
      '« Na-na-nè-reu » (moquerie de cour de récré)',
      'L’hymne américain (« Oh say »)',
    ],
  },
  M3: {
    asc: [
      'When the Saints Go Marching In',
      'Kumbaya',
      'Michael, Row the Boat Ashore',
      'Le Beau Danube bleu (J. Strauss)',
      'Where Is My Mind? (Pixies), riff de guitare',
    ],
    desc: [
      '5e Symphonie (Beethoven)',
      'Summertime (« Sum-mer »)',
      'Swing Low, Sweet Chariot',
      'Where Is My Mind? (Pixies), riff de guitare',
    ],
  },
  P4: {
    asc: [
      'La Marseillaise (« Allons »)',
      'Mon beau sapin',
      'Ce n’est qu’un au revoir',
      'Amazing Grace',
      'Marche nuptiale (Wagner)',
      'Harry Potter (thème d’Hedwige)',
    ],
    desc: ['Une petite musique de nuit (Mozart)', 'Frère Jacques (« din, dan, don »)'],
  },
  TT: {
    asc: ['Les Simpson (générique)', 'Maria (West Side Story)'],
    desc: ['Black Sabbath (le morceau du groupe), après l’octave'],
  },
  P5: {
    asc: [
      'Ah ! vous dirai-je, maman',
      'Star Wars (thème principal), après le triolet',
      'Ainsi parlait Zarathoustra (R. Strauss)',
      'Scarborough Fair',
      'In the End (Linkin Park), riff de piano',
    ],
    desc: ['Les Pierrafeu (générique)', 'Game of Thrones (générique)'],
  },
  m6: {
    asc: ['The Entertainer (Joplin), après les notes d’appel'],
    desc: [],
  },
  M6: {
    asc: [
      'My Bonnie Lies Over the Ocean',
      'Vive le vent (couplet, « Sur le long che-min »)',
      'Brindisi de La Traviata (« Li-bia-mo »)',
      'Nocturne op. 9 n° 2 (Chopin)',
    ],
    desc: ['Nobody Knows the Trouble I’ve Seen'],
  },
  m7: {
    asc: ['Star Trek (série originale, générique)', 'Somewhere (West Side Story)'],
    desc: [],
  },
  M7: {
    asc: ['Take On Me (a-ha), refrain', 'Over the Rainbow, 1re et 3e notes'],
    desc: ['I Love You (Cole Porter)'],
  },
  P8: {
    asc: [
      'Over the Rainbow (« Some-where »)',
      'When You Wish Upon a Star (Pinocchio)',
      'Sweet Child o’ Mine (Guns N’ Roses), riff',
    ],
    desc: [],
  },
};

/** Clé d'un repère : « M3:asc ». */
export function landmarkKey(code: IntervalCode, direction: LandmarkDirection): string {
  return `${code}:${direction}`;
}

/**
 * Repères à afficher : celui de l'utilisateur s'il en a saisi un, sinon les
 * suggestions, parfois aucune. En harmonique, les repères ascendants.
 */
export function landmarksFor(
  code: IntervalCode,
  presentation: string,
  custom: Readonly<Record<string, string>>,
): readonly string[] {
  const direction: LandmarkDirection = presentation === 'desc' ? 'desc' : 'asc';
  const own = custom[landmarkKey(code, direction)]?.trim();
  return own ? [own] : INTERVAL_LANDMARKS[code][direction];
}
