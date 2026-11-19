import { expect, test, type Page } from '@playwright/test';

// Parcours d'accords (J4) : triades arpégées puis plaquées avec l'aide « écouter
// arpégé », ouverture des Renversements, réponse par le renversement.

const NAMES: Record<string, string> = {
  maj: 'Majeur (M)',
  min: 'Mineur (m)',
  dim: 'Diminué (°)',
  inv0: 'État fondamental',
  inv1: '1er renversement',
};

declare global {
  interface Window {
    __oreilleReponse?: string;
    __oreilleNumero?: number;
  }
}

let seen = 0;

async function nextQuestion(page: Page): Promise<string> {
  await page.waitForFunction((n) => (window.__oreilleNumero ?? 0) > n, seen);
  const answers = page.getByRole('group', { name: 'Réponses' }).getByRole('button');
  await expect(answers.first()).toBeEnabled();
  seen = await page.evaluate(() => window.__oreilleNumero ?? 0);
  return page.evaluate(() => window.__oreilleReponse ?? '');
}

async function answer(page: Page, decide: (answer: string) => string = (a) => a) {
  const expected = await nextQuestion(page);
  await page.getByRole('button', { name: NAMES[decide(expected)], exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Bonne réponse|Non :/ })).toBeVisible();
  return expected;
}

/** « Je connais déjà » (en découverte ou en entraînement), puis un test sans faute. */
async function passTest(page: Page, stepId: string) {
  await page.goto(`./#/etape/${stepId}`);
  await page
    .getByRole('button', { name: /^Je connais déjà : passer (directement )?le test$/ })
    .click();
  while (!(await page.getByRole('heading', { name: /Étape validée/ }).isVisible())) {
    await answer(page);
    await page.keyboard.press('Enter');
  }
}

test('triades, aide arpégée et renversements', async ({ page }) => {
  seen = 0;
  await page.goto('./');
  await page.getByRole('button', { name: /Écouter un accord/ }).click();
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page.getByRole('heading', { name: 'Séance du jour' })).toBeVisible();

  // Les Renversements attendent les triades plaquées.
  await page.goto('./#/parcours');
  const inversions = page.getByRole('region', { name: 'Renversements' });
  await expect(inversions.getByText("S'ouvre après Triades plaquées, étape 1.")).toBeVisible();

  await passTest(page, 'tri.arp.01');

  // Accord plaqué : l'aide « écouter arpégé », puis une erreur et l'écoute comparée.
  await page.goto('./#/etape/tri.block.01');
  await page.getByRole('button', { name: 'Continuer : entraînement' }).click();
  await nextQuestion(page);
  seen -= 1;
  await page.getByRole('button', { name: /Écouter arpégé/ }).click();
  const played = await answer(page, (a) => (a === 'maj' ? 'min' : 'maj'));
  const status = page.getByRole('status').filter({ hasText: 'Non :' });
  await expect(status).toContainText(
    played === 'maj' ? 'un accord parfait majeur (M)' : 'un accord parfait mineur (m)',
  );
  // Symboles français et internationaux : « Rém · Dm ».
  await expect(status).toContainText(/ · [A-G]/);
  await expect(page.getByRole('button', { name: /Écouter ta réponse/ })).toBeVisible();
  await page.keyboard.press('Enter');

  await passTest(page, 'tri.block.01');

  // Renversements, étape 1 : on répond par le renversement.
  await page.goto('./#/parcours');
  await expect(inversions.getByText(/S'ouvre après/)).toHaveCount(0);
  await passTest(page, 'inv.block.01');
  await page.goto('./#/parcours');
  await expect(inversions.getByText('1 / 6 étapes validées')).toBeVisible();
});
