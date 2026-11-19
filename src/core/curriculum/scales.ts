import type { TrackDef } from './types';

/**
 * Parcours Gammes (docs/DESIGN.md §7.2), ouvert quand les tierces ascendantes sont
 * connues. La mineure mélodique n'a pas de ligne « descendante » : sa descente
 * classique se confond avec la mineure naturelle.
 */
export const SCALES_TRACK: TrackDef = {
  id: 'scales',
  family: 'scl',
  prefix: 'scl',
  name: 'Gammes',
  rows: [
    {
      presentation: 'updown',
      label: 'Monte et descend',
      title: 'Gammes montantes et descendantes',
    },
    { presentation: 'asc', label: 'Montante', title: 'Gammes montantes' },
    { presentation: 'desc', label: 'Descendante', title: 'Gammes descendantes' },
  ],
  columns: [
    { add: ['major', 'natmin'] },
    { add: ['harmin'], contrast: { harmin: ['natmin'] } },
    { add: ['pentmaj'], contrast: { pentmaj: ['major'] } },
    { add: ['pentmin'], contrast: { pentmin: ['natmin'] } },
    { add: ['blues'], contrast: { blues: ['pentmin'] } },
    { add: ['melmin'], contrast: { melmin: ['harmin', 'major'] }, rows: ['updown', 'asc'] },
  ],
  range: ['C3', 'C4'],
  unlockedBy: ['int.asc.03'],
};

/**
 * Parcours Modes, ouvert par la mineure harmonique (Gammes, colonne 2). Les modes
 * s'entendent d'abord sur un bourdon, puis sans, puis dans une mélodie (§6.3).
 */
export const MODES_TRACK: TrackDef = {
  id: 'modes',
  family: 'mod',
  prefix: 'mod',
  name: 'Modes',
  rows: [
    { presentation: 'drone', label: 'Bourdon', title: 'Modes sur bourdon' },
    { presentation: 'plain', label: 'Sans bourdon', title: 'Modes sans bourdon' },
    { presentation: 'melody', label: 'Mélodie', title: 'Mélodies modales' },
  ],
  columns: [
    { add: ['ionian', 'aeolian'] },
    { add: ['mixolydian'], contrast: { mixolydian: ['ionian'] } },
    { add: ['dorian'], contrast: { dorian: ['aeolian'] } },
    { add: ['lydian'], contrast: { lydian: ['ionian'] } },
    { add: ['phrygian'], contrast: { phrygian: ['aeolian'] } },
    { add: ['locrian'], contrast: { locrian: ['phrygian'] } },
  ],
  range: ['C3', 'C4'],
  unlockedBy: ['scl.updown.02'],
};
