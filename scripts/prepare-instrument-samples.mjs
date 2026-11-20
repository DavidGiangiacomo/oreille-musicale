#!/usr/bin/env node
// Prépare les échantillons des timbres « vibraphone » et « cordes » à partir de
// banques de sons dédiées au domaine public (CC0) :
//   - vibraphone : Versilian Community Sample Library (VCSL), Sam Gossner,
//     https://github.com/sgossner/VCSL, dossier
//     « Idiophones/Struck Idiophones/Vibraphone/Soft Mallets » ;
//   - cordes : VS Chamber Orchestra 2 Community Edition (VSCO 2 CE), Versilian
//     Studios, https://github.com/sgossner/VSCO-2-CE, dossier « Strings » (pupitre
//     de violoncelles pour le grave, pupitre d'altos au-dessus, notes tenues).
//
// Usage : node scripts/prepare-instrument-samples.mjs <vibraphone|strings> <dossier source>
//
// Les fichiers sources nomment les notes avec le do central à « C3 » : la hauteur
// MIDI réelle est donnée ici pour chacun (vérifiée par mesure de la fondamentale,
// écarts de moins de 10 cents). Pour chaque note :
//   - passage en mono, coupure et fondu de sortie ;
//   - gain fixe pour amener la sonie des 2 premières secondes à -23 LUFS, comme
//     celle des échantillons de piano, crête plafonnée à -1 dBTP ;
//   - encodage MP3 (VBR, qualité 4).
// Nécessite ffmpeg compilé avec libmp3lame.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const TARGET_LUFS = -23;
const MEASURE_SECONDS = 2;
const MAX_TRUE_PEAK = -1;

const INSTRUMENTS = {
  vibraphone: {
    // Lame frappée : le son décroît de lui-même, comme le piano. La lame la plus
    // grave (F3) est étouffée dans la banque, et le A3 de la nuance v2 a une attaque
    // anormalement forte : on part du A3 en nuance v1, transposé vers le bas au besoin.
    duration: 5,
    fade: 2,
    files: [
      ['Vibes_soft_A2_v1_rr1_Main.wav', 57],
      ['Vibes_soft_C3_v2_rr1_Main.wav', 60],
      ['Vibes_soft_E3_v2_rr1_Main.wav', 64],
      ['Vibes_soft_G3_v2_rr1_Main.wav', 67],
      ['Vibes_soft_B3_v2_rr1_Main.wav', 71],
      ['Vibes_soft_D4_v2_rr1_Main.wav', 74],
      ['Vibes_soft_F4_v2_rr1_Main.wav', 77],
      ['Vibes_soft_A4_v2_rr1_Main.wav', 81],
      ['Vibes_soft_C5_v2_rr1_Main.wav', 84],
      ['Vibes_soft_E5_v2_rr1_Main.wav', 88],
    ],
  },
  strings: {
    // Son tenu : assez long pour l'arpège le plus lent, avec un fondu court.
    duration: 6,
    fade: 0.5,
    files: [
      ['Cello Section/susvib/susvib_C1_v3_1.wav', 36],
      ['Cello Section/susvib/susvib_E1_v3_1.wav', 40],
      ['Cello Section/susvib/susvib_G1_v3_1.wav', 43],
      ['Cello Section/susvib/susvib_B1_v3_1.wav', 47],
      ['Viola Section/susvib/ViolaEns_susvib_C2_v2_1.wav', 48],
      ['Viola Section/susvib/ViolaEns_susvib_D2_v2_1.wav', 50],
      ['Viola Section/susvib/ViolaEns_susvib_E2_v2_1.wav', 52],
      ['Viola Section/susvib/ViolaEns_susvib_G2_v2_1.wav', 55],
      ['Viola Section/susvib/ViolaEns_susvib_B2_v2_1.wav', 59],
      ['Viola Section/susvib/ViolaEns_susvib_D3_v2_1.wav', 62],
      ['Viola Section/susvib/ViolaEns_susvib_F3_v2_1.wav', 65],
      ['Viola Section/susvib/ViolaEns_susvib_A3_v2_1.wav', 69],
      ['Viola Section/susvib/ViolaEns_susvib_C4_v2_1.wav', 72],
      ['Viola Section/susvib/ViolaEns_susvib_E4_v2_1.wav', 76],
      ['Viola Section/susvib/ViolaEns_susvib_G4_v2_1.wav', 79],
      ['Viola Section/susvib/ViolaEns_susvib_B4_v2_1.wav', 83],
      ['Viola Section/susvib/ViolaEns_susvib_D5_v2_1.wav', 86],
    ],
  },
};

const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];

/** Nom du fichier produit, comme pour le piano : 53 → « F3 », 61 → « Cs4 ». */
function noteName(midi) {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`ffmpeg a échoué :\n${result.stderr}`);
  return result.stderr;
}

/** Sonie intégrée (LUFS) et crête vraie (dBTP) du début de l'extrait, en mono. */
function measure(file) {
  const log = ffmpeg([
    '-i',
    file,
    '-t',
    String(MEASURE_SECONDS),
    '-af',
    `pan=mono|c0=0.5*c0+0.5*c1,loudnorm=I=${TARGET_LUFS}:TP=${MAX_TRUE_PEAK}:print_format=json`,
    '-f',
    'null',
    '-',
  ]);
  const { input_i, input_tp } = JSON.parse(
    log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1),
  );
  return { integrated: Number(input_i), truePeak: Number(input_tp) };
}

const [instrument, source] = process.argv.slice(2);
const config = INSTRUMENTS[instrument];
if (!config || !source || !existsSync(source)) {
  console.error(
    'Usage : node scripts/prepare-instrument-samples.mjs <vibraphone|strings> <dossier source>',
  );
  process.exit(1);
}

const output = resolve('public/samples', instrument);
mkdirSync(output, { recursive: true });
const filters = `pan=mono|c0=0.5*c0+0.5*c1,afade=t=out:st=${config.duration - config.fade}:d=${config.fade}`;
for (const [file, midi] of config.files) {
  const input = join(source, file);
  if (!existsSync(input)) throw new Error(`Échantillon manquant : ${input}`);
  const { integrated, truePeak } = measure(input);
  const gain = Math.min(TARGET_LUFS - integrated, MAX_TRUE_PEAK - truePeak);
  const name = noteName(midi);
  ffmpeg([
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-t',
    String(config.duration),
    '-af',
    `${filters},volume=${gain.toFixed(2)}dB`,
    '-ar',
    '44100',
    '-c:a',
    'libmp3lame',
    '-q:a',
    '4',
    '-map_metadata',
    '-1',
    join(output, `${name}.mp3`),
  ]);
  console.log(`${name.padEnd(4)} ${integrated.toFixed(1)} LUFS → gain ${gain.toFixed(1)} dB`);
}
