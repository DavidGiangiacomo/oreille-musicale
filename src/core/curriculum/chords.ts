import type { TrackDef } from './types';

const CHORD_ROWS = (name: string): TrackDef['rows'] => [
  { presentation: 'arp', label: 'Arpégé', title: `${name} arpégées` },
  { presentation: 'block', label: 'Plaqué', title: `${name} plaquées` },
  { presentation: 'inv', label: 'Renversé', title: `${name} renversées` },
];

/**
 * Parcours Triades (docs/DESIGN.md §7.2). Les accords suspendus n'ont pas de ligne
 * « renversé » : renversés, ils s'entendent comme d'autres accords (§6.2).
 */
export const TRIADS_TRACK: TrackDef = {
  id: 'triads',
  family: 'chd',
  prefix: 'tri',
  name: 'Triades',
  rows: CHORD_ROWS('Triades'),
  columns: [
    { add: ['maj', 'min'] },
    { add: ['dim'], contrast: { dim: ['min'] } },
    { add: ['aug'], contrast: { aug: ['maj'] } },
    { add: ['sus4'], contrast: { sus4: ['maj'] }, rows: ['arp', 'block'] },
    { add: ['sus2'], contrast: { sus2: ['sus4'] }, rows: ['arp', 'block'] },
  ],
  range: ['C3', 'C4'],
};

/** Parcours Septièmes, ouvert quand les triades diminuées plaquées sont validées. */
export const SEVENTHS_TRACK: TrackDef = {
  id: 'sevenths',
  family: 'chd',
  prefix: 'sev',
  name: 'Septièmes',
  rows: CHORD_ROWS('Septièmes'),
  columns: [
    { add: ['dom7', 'maj7'] },
    { add: ['m7'], contrast: { m7: ['dom7'] } },
    { add: ['m7b5'], contrast: { m7b5: ['m7'] } },
    { add: ['dim7'], contrast: { dim7: ['m7b5'] } },
    { add: ['mmaj7'], contrast: { mmaj7: ['m7'] } },
    { add: ['7sus4'], contrast: { '7sus4': ['dom7'] }, rows: ['arp', 'block'] },
  ],
  range: ['C3', 'C4'],
  unlockedBy: ['tri.block.02'],
};

const inversions = (quality: string, count: number) =>
  Array.from({ length: count }, (_, k) => `${quality}.${k}`);

/**
 * Parcours Renversements : accords plaqués, on répond par le renversement. Une suite
 * linéaire de six étapes, dont les éléments ne s'accumulent pas (R3 : mineur seul).
 * Les accords augmentés, de septième diminuée et suspendus en sont exclus.
 */
export const INVERSIONS_TRACK: TrackDef = {
  id: 'inversions',
  family: 'inv',
  prefix: 'inv',
  name: 'Renversements',
  rows: [{ presentation: 'block', label: 'Plaqué', title: 'Renversements' }],
  columns: [
    { items: inversions('maj', 2), newItems: inversions('maj', 2) },
    {
      items: inversions('maj', 3),
      newItems: ['maj.2'],
      contrast: { 'maj.2': ['maj.1'] },
    },
    { items: inversions('min', 3), newItems: inversions('min', 3) },
    { items: [...inversions('maj', 3), ...inversions('min', 3)], newItems: [] },
    { items: inversions('dom7', 4), newItems: inversions('dom7', 4), requires: ['sev.block.01'] },
    {
      items: [...inversions('dom7', 4), ...inversions('maj7', 4), ...inversions('m7', 4)],
      newItems: [...inversions('maj7', 4), ...inversions('m7', 4)],
      requires: ['sev.block.02'],
    },
  ],
  range: ['C3', 'C4'],
  unlockedBy: ['tri.block.01'],
};
