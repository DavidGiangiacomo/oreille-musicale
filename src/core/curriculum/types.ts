import type { FamilyId, Generation } from '../exercise/question';
import type { Presentation } from '../exercise/rendition';

/** Parcours disponibles ; les gammes et modes s'ajouteront ici. */
export type TrackId = 'intervals' | 'triads' | 'sevenths' | 'inversions';

/** Phases d'une étape (§7.3). */
export type StepPhase = 'discover' | 'contrast' | 'train' | 'test';

export interface StepDef {
  /** « int.asc.02 » : parcours, présentation, colonne. */
  id: string;
  track: TrackId;
  family: FamilyId;
  /** Ligne de la grille (la présentation), à partir de 0. */
  row: number;
  /** Colonne de la grille, à partir de 1. */
  column: number;
  presentation: Presentation;
  /**
   * Éléments joués, qui sont aussi les compétences de l'étape. Pour les intervalles
   * et les accords, ce sont les réponses ; pour les renversements, un accord dans un
   * renversement (« maj.1 »), la réponse étant le renversement.
   */
  items: string[];
  /** Réponses proposées, dans l'ordre des boutons. */
  answers: string[];
  /** Éléments introduits par l'étape. */
  newItems: string[];
  /** Voisins de chaque nouvel élément, pour la phase de comparaison. */
  contrast: Partial<Record<string, string[]>>;
  generation: Generation;
  validation: { minAccuracy: number; minNewItemAccuracy: number };
  /** Étapes à valider d'abord : celle de gauche, celle du dessus, et d'autres parcours. */
  requires: string[];
}

export interface TrackRow {
  presentation: Presentation;
  /** En tête de colonne de la grille : « Ascendant », « Plaqué ». */
  label: string;
  /** Titre d'une étape de la ligne : « Intervalles ascendants », « Triades plaquées ». */
  title: string;
}

export interface TrackColumn {
  /** Éléments ajoutés par la colonne ; ils s'accumulent de gauche à droite. */
  add?: string[];
  /** Ou bien : les éléments de l'étape, quand ils ne s'accumulent pas (Renversements). */
  items?: string[];
  /** Nouveaux éléments, quand `items` est donné. */
  newItems?: string[];
  /** Voisins des éléments ajoutés, déjà connus, pour la comparaison. */
  contrast?: Partial<Record<string, string[]>>;
  /** Lignes où la colonne existe ; toutes par défaut. */
  rows?: Presentation[];
  /** Étapes d'autres parcours à valider aussi. */
  requires?: string[];
}

export interface TrackDef {
  id: TrackId;
  family: FamilyId;
  /** Préfixe des identifiants d'étape : « int ». */
  prefix: string;
  name: string;
  /** Lignes de la grille, de la présentation la plus facile à la plus difficile. */
  rows: TrackRow[];
  columns: TrackColumn[];
  /** Registre de la note de référence (basse des accords), en notation scientifique. */
  range: readonly [string, string];
  /** Étapes d'autres parcours à valider avant la première étape (§7.2). */
  unlockedBy?: string[];
}
