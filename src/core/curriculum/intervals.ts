import type { TrackDef } from './types';

/**
 * Parcours Intervalles (docs/DESIGN.md §7.2) : chaque colonne ajoute un intervalle,
 * comparé d'abord à ses voisins les plus proches parmi ceux déjà connus.
 */
export const INTERVALS_TRACK: TrackDef = {
  id: 'intervals',
  prefix: 'int',
  name: 'Intervalles',
  rows: [
    { presentation: 'asc', label: 'Ascendant' },
    { presentation: 'desc', label: 'Descendant' },
    { presentation: 'harm', label: 'Harmonique' },
  ],
  range: ['F3', 'F5'],
  columns: [
    { add: ['M3', 'P5', 'P8'] },
    { add: ['P4'], contrast: { P4: ['P5', 'M3'] } },
    { add: ['m3'], contrast: { m3: ['M3'] } },
    { add: ['M2'], contrast: { M2: ['m3'] } },
    { add: ['m2'], contrast: { m2: ['M2'] } },
    { add: ['M6'], contrast: { M6: ['P5'] } },
    { add: ['m6'], contrast: { m6: ['M6', 'P5'] } },
    { add: ['m7'], contrast: { m7: ['M6', 'P8'] } },
    { add: ['M7'], contrast: { M7: ['P8', 'm7'] } },
    { add: ['TT'], contrast: { TT: ['P4', 'P5'] } },
  ],
};
