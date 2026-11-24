import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { formatNote } from '../src/core/theory';

// Labo micro (§11) : Chromium lit un fichier WAV à la place du micro. Une « voix »
// synthétique tient un la à 220 Hz, avec ses harmoniques et un léger vibrato.

function voiceWav(frequency: number, seconds: number): Buffer {
  const rate = 48_000;
  const count = rate * seconds;
  const data = Buffer.alloc(44 + count * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + count * 2, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(count * 2, 40);
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const f = frequency * 2 ** ((10 / 1200) * Math.sin((2 * Math.PI * 5 * i) / rate));
    phase += (2 * Math.PI * f) / rate;
    let value = 0;
    for (let h = 1; h <= 6; h++) value += Math.sin(h * phase) / h;
    data.writeInt16LE(Math.round(value * 0.15 * 32767), 44 + i * 2);
  }
  return data;
}

const dir = join(tmpdir(), 'oreille-musicale-e2e');
mkdirSync(dir, { recursive: true });
const wav = join(dir, 'la-220.wav');
writeFileSync(wav, voiceWav(220, 3));

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${wav}`,
    ],
  },
});

test('le Labo micro reconnaît une note tenue', async ({ page }) => {
  await page.goto('./#/bienvenue');
  await page.getByRole('button', { name: "C'est parti" }).click();
  await page.goto('./#/a-propos');
  await page.getByRole('link', { name: 'Essayer la détection de la voix' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Labo micro' })).toBeVisible();

  await page.getByRole('button', { name: 'Activer le micro' }).click();
  const expected = formatNote('A3', { naming: 'fr', octave: 'fr' });
  await expect(page.getByLabel('Note détectée')).toHaveText(expected, { timeout: 10_000 });
  await expect(page.getByText(/^\+?−?\d+ cents|^Juste$/)).toBeVisible();

  await page.getByRole('button', { name: 'Arrêter le micro' }).click();
  const bilan = page.getByRole('region', { name: 'Bilan' });
  await expect(bilan.getByText(/Voix détectée : \d+/)).toBeVisible();
  await expect(bilan.getByText(new RegExp(`Notes chantées : de ${expected}`))).toBeVisible();
});
