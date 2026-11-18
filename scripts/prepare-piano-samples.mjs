#!/usr/bin/env node
// Prépare les échantillons de piano de l'application à partir du Salamander Grand
// Piano d'Alexander Holm (licence CC BY 3.0), tel que publié dans le dossier
// `salamander/` du dépôt https://github.com/Tonejs/audio.
//
// Usage : node scripts/prepare-piano-samples.mjs <dossier salamander source>
//
// Pour chaque note (de A1 à C7, une tous les 3 demi-tons) :
//   - passage en mono et coupure à 5 s, avec un fondu de sortie de 2 s ;
//   - gain fixe pour amener la sonie à -25 LUFS, plafonné à -1 dBTP en crête,
//     afin que tous les registres aient le même volume perçu ;
//   - encodage MP3 (VBR, qualité 4), lisible par tous les navigateurs.
// Nécessite ffmpeg compilé avec libmp3lame.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DURATION = 5;
const FADE = 2;
const TARGET_LUFS = -25;
const MAX_TRUE_PEAK = -1;
const OUTPUT_DIR = resolve('public/samples/piano');
const BASE_FILTERS = `pan=mono|c0=0.5*c0+0.5*c1,afade=t=out:st=${DURATION - FADE}:d=${FADE}`;

/** Noms des fichiers : A1, C2, Ds2, Fs2, A2… C7 (MIDI 33 à 96, par pas de 3). */
function sampleNames() {
  const letters = { 9: 'A', 0: 'C', 3: 'Ds', 6: 'Fs' };
  const names = [];
  for (let midi = 33; midi <= 96; midi += 3) {
    names.push(`${letters[midi % 12]}${Math.floor(midi / 12) - 1}`);
  }
  return names;
}

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`ffmpeg a échoué :\n${result.stderr}`);
  return result.stderr;
}

/** Sonie intégrée (LUFS) et crête vraie (dBTP) de l'extrait, après mono et fondu. */
function measure(file) {
  const log = ffmpeg([
    '-i',
    file,
    '-t',
    String(DURATION),
    '-af',
    `${BASE_FILTERS},loudnorm=I=${TARGET_LUFS}:TP=${MAX_TRUE_PEAK}:print_format=json`,
    '-f',
    'null',
    '-',
  ]);
  const { input_i, input_tp } = JSON.parse(
    log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1),
  );
  return { integrated: Number(input_i), truePeak: Number(input_tp) };
}

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error('Usage : node scripts/prepare-piano-samples.mjs <dossier salamander source>');
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const name of sampleNames()) {
  const input = join(source, `${name}.mp3`);
  if (!existsSync(input)) throw new Error(`Échantillon manquant : ${input}`);
  const { integrated, truePeak } = measure(input);
  const gain = Math.min(TARGET_LUFS - integrated, MAX_TRUE_PEAK - truePeak);
  ffmpeg([
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-t',
    String(DURATION),
    '-af',
    `${BASE_FILTERS},volume=${gain.toFixed(2)}dB`,
    '-ar',
    '44100',
    '-c:a',
    'libmp3lame',
    '-q:a',
    '4',
    '-map_metadata',
    '-1',
    join(OUTPUT_DIR, `${name}.mp3`),
  ]);
  console.log(`${name.padEnd(4)} ${integrated.toFixed(1)} LUFS → gain ${gain.toFixed(1)} dB`);
}
