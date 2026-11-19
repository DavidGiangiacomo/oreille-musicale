import type { IntervalPresentation, Tempo } from '../exercise/rendition';
import type { IntervalCode } from '../theory';

/** Parcours disponibles ; les accords, gammes et modes s'ajouteront ici. */
export type TrackId = 'intervals';

/** Phases d'une étape (§7.3). */
export type StepPhase = 'discover' | 'contrast' | 'train' | 'test';

export interface StepDef {
  /** « int.asc.02 » : parcours, présentation, colonne. */
  id: string;
  track: TrackId;
  /** Ligne de la grille (la présentation), à partir de 0. */
  row: number;
  /** Colonne de la grille, à partir de 1. */
  column: number;
  presentation: IntervalPresentation;
  /** Réponses proposées, dans l'ordre des boutons. */
  answers: IntervalCode[];
  /** Éléments introduits par l'étape. */
  newItems: IntervalCode[];
  /** Voisins de chaque nouvel élément, pour la phase de comparaison. */
  contrast: Partial<Record<IntervalCode, IntervalCode[]>>;
  generation: { range: readonly [number, number]; tempo: Tempo };
  validation: { minAccuracy: number; minNewItemAccuracy: number };
  /** Étapes à valider d'abord : celle de gauche et celle du dessus dans la grille. */
  requires: string[];
}

export interface TrackColumn {
  /** Éléments ajoutés par la colonne. */
  add: IntervalCode[];
  /** Voisins des éléments ajoutés, déjà connus, pour la comparaison. */
  contrast?: Partial<Record<IntervalCode, IntervalCode[]>>;
}

export interface TrackDef {
  id: TrackId;
  /** Préfixe des identifiants d'étape : « int ». */
  prefix: string;
  name: string;
  /** Lignes de la grille, de la présentation la plus facile à la plus difficile. */
  rows: { presentation: IntervalPresentation; label: string }[];
  columns: TrackColumn[];
  /** Registre des questions, en notation scientifique. */
  range: readonly [string, string];
}
