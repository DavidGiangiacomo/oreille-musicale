// Chansons repères des intervalles (docs/DESIGN.md §6.1) : un air connu dont les deux
// premières notes forment l'intervalle. Ce sont des aide-mémoire ; l'utilisateur peut
// les remplacer par les siens, les plus efficaces étant des airs qu'il connaît bien.
import type { IntervalCode } from '../theory';

export type LandmarkDirection = 'asc' | 'desc';

export const INTERVAL_LANDMARKS: Readonly<
  Record<IntervalCode, Partial<Record<LandmarkDirection, string>>>
> = {
  m2: { asc: 'Les Dents de la mer (thème)', desc: 'La Lettre à Élise (Beethoven)' },
  M2: { asc: 'Frère Jacques', desc: 'Yesterday (Beatles)' },
  m3: { asc: 'Greensleeves', desc: 'Hey Jude (Beatles)' },
  M3: { asc: 'When the Saints Go Marching In', desc: '5e Symphonie (Beethoven)' },
  P4: { asc: 'La Marseillaise (« Allons »)', desc: 'Une petite musique de nuit (Mozart)' },
  TT: { asc: 'Les Simpson (générique)' },
  P5: { asc: 'Ah ! vous dirai-je, maman', desc: 'Les Pierrafeu (générique)' },
  m6: { asc: 'The Entertainer (Joplin), après les notes d’appel' },
  M6: { asc: 'My Bonnie Lies Over the Ocean', desc: 'Nobody Knows the Trouble I’ve Seen' },
  m7: { asc: 'Star Trek (série originale, générique)' },
  M7: { asc: 'Take On Me (a-ha), refrain' },
  P8: { asc: 'Over the Rainbow (« Some-where »)' },
};

/** Clé d'un repère : « M3:asc ». */
export function landmarkKey(code: IntervalCode, direction: LandmarkDirection): string {
  return `${code}:${direction}`;
}

/**
 * Repère à afficher : celui de l'utilisateur s'il en a saisi un, sinon la
 * suggestion. En harmonique, le repère ascendant.
 */
export function landmarkFor(
  code: IntervalCode,
  presentation: string,
  custom: Readonly<Record<string, string>>,
): string | null {
  const direction: LandmarkDirection = presentation === 'desc' ? 'desc' : 'asc';
  const own = custom[landmarkKey(code, direction)]?.trim();
  return own || INTERVAL_LANDMARKS[code][direction] || null;
}
