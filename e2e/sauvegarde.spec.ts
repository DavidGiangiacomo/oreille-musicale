import { expect, test, type Page } from '@playwright/test';

// Export puis import de la progression (§10.6) : d'un appareil à l'autre.

const NAMES: Record<string, string> = {
  M3: '3M Tierce majeure',
  P5: '5J Quinte juste',
  P8: '8J Octave',
};

declare global {
  interface Window {
    __oreilleReponse?: string;
    __oreilleNumero?: number;
  }
}

async function onboard(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: /Écouter un accord/ }).click();
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page.getByRole('heading', { name: 'Séance du jour' })).toBeVisible();
}

test('transfère la progression d’un appareil à l’autre', async ({ page, browser }) => {
  // Premier appareil : l'étape 1 est validée.
  await onboard(page);
  await page.goto('./#/etape/int.asc.01');
  await page.getByRole('button', { name: 'Je connais déjà : passer directement le test' }).click();
  let seen = 0;
  while (!(await page.getByRole('heading', { name: /Étape validée/ }).isVisible())) {
    await page.waitForFunction((n) => (window.__oreilleNumero ?? 0) > n, seen);
    seen = await page.evaluate(() => window.__oreilleNumero ?? 0);
    const expected = await page.evaluate(() => window.__oreilleReponse ?? '');
    await page.getByRole('button', { name: NAMES[expected], exact: true }).click();
    await page.keyboard.press('Enter');
  }

  await page.goto('./');
  const backup = page.getByRole('region', { name: 'Sauvegarde' });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    backup.getByRole('button', { name: 'Exporter mes données' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^oreille-musicale-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();

  // Second appareil, vierge : import, confirmation, progression retrouvée.
  const other = await browser.newPage();
  await onboard(other);
  const otherBackup = other.getByRole('region', { name: 'Sauvegarde' });
  await otherBackup.getByLabel('Fichier de sauvegarde à importer').setInputFiles(file);
  await expect(otherBackup.getByText(/Elle remplacera toutes les données/)).toBeVisible();
  await expect(otherBackup.getByText(/1 séance et 12 réponses/)).toBeVisible();
  await otherBackup.getByRole('button', { name: 'Remplacer mes données' }).click();
  await other.waitForLoadState('load');
  await other.goto('./#/parcours');
  await expect(
    other.getByRole('region', { name: 'Intervalles' }).getByText('1 / 30 étapes validées'),
  ).toBeVisible();
  await other.close();
});

test('refuse un fichier qui n’est pas une sauvegarde', async ({ page }) => {
  await onboard(page);
  const backup = page.getByRole('region', { name: 'Sauvegarde' });
  await backup.getByLabel('Fichier de sauvegarde à importer').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"bonjour": true}'),
  });
  await expect(backup.getByRole('alert')).toContainText('pas une sauvegarde');
});
