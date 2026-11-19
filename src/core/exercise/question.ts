// Question générique (docs/DESIGN.md §6.5) : ce que le cœur produit pour chaque
// famille d'éléments, et que l'interface joue et évalue sans les connaître.
import type { NoteName } from '../theory';
import type { NoteEvent, Presentation, Tempo } from './rendition';

/** Familles d'éléments : intervalles, accords (qualité), renversements. */
export type FamilyId = 'int' | 'chd' | 'inv';

export const FAMILY_IDS: readonly FamilyId[] = ['int', 'chd', 'inv'];

/** Notes orthographiées, hauteurs MIDI et événements à jouer. */
export interface Sound {
  notes: NoteName[];
  midi: number[];
  events: NoteEvent[];
}

/**
 * Manière de répondre : boutons en v1. Le chant (`sung`) s'ajoutera en v2 sans
 * toucher à l'évaluation des questions (§11.7).
 */
export type AnswerType = 'choice';

export interface QuestionBase extends Sound {
  family: FamilyId;
  /** « int:M3:asc », « chd:min:block », « inv:maj.1:block ». */
  competenceId: string;
  /** Élément joué : « M3 », « min », « maj.1 » (accord majeur, 1er renversement). */
  item: string;
  /** Réponse attendue : l'élément lui-même, ou le renversement (« inv1 »). */
  answer: string;
  presentation: Presentation;
  tempo: Tempo;
  /** Réponses proposées, dans l'ordre fixe des boutons. */
  choices: string[];
  answerType: AnswerType;
  /**
   * Note de référence de la réalisation (première note d'un intervalle, basse d'un
   * accord) : la question suivante en prend une autre.
   */
  anchor: number;
}

/** Ajustement de la difficulté en entraînement (§7.5). */
export type Difficulty = 'easier' | 'normal' | 'harder';

/** Registre (de la note de référence) et tempo d'une réalisation. */
export interface Generation {
  range: readonly [number, number];
  tempo: Tempo;
}
