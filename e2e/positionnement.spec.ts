import { expect, test, type Page } from '@playwright/test';

// Test de positionnement (§7.6) : deux paliers réussis, le troisième raté.

const NAMES: Record<string, string> = {
  m2: 'Seconde mineure (2m)',
  M2: 'Seconde majeure (2M)',
  m3: 'Tierce mineure (3m)',
  M3: 'Tierce majeure (3M)',
  P4: 'Quarte juste (4J)',
  TT: 'Triton (4+/5−)',
  P5: 'Quinte juste (5J)',
  m6: 'Sixte mineure (6m)',
  M6: 'Sixte majeure (6M)',
  m7: 'Septième mineure (7m)',
  M7: 'Septième majeure (7M)',
  P8: 'Octave (8J)',
};

declare global {
  interface Window {
    __oreilleReponse?: string;
    __oreilleNumero?: number;
  }
}

let seen = 0;

/** Répond aux 6 questions d'un palier, juste ou faux selon `correct`. */
async function answerTier(page: Page, correct: (index: number) => boolean) {
  for (let i = 0; i < 6; i++) {
    await page.waitForFunction((n) => (window.__oreilleNumero ?? 0) > n, seen);
    seen = await page.evaluate(() => window.__oreilleNumero ?? 0);
    const expected = await page.evaluate(() => window.__oreilleReponse ?? '');
    const wrong = expected === 'P8' ? 'P5' : 'P8';
    await page
      .getByRole('button', { name: NAMES[correct(i) ? expected : wrong], exact: true })
      .click();
    await expect(page.getByRole('status').filter({ hasText: /Bonne réponse|Non :/ })).toBeVisible();
    await page.keyboard.press('Enter');
  }
}

test('valide les étapes des paliers réussis', async ({ page }) => {
  seen = 0;
  await page.goto('./');
  await page.getByRole('button', { name: /Écouter un accord/ }).click();
  await page.getByRole('button', { name: "J'ai déjà des bases" }).click();
  await expect(page.getByRole('heading', { name: 'Tests de positionnement' })).toBeVisible();
  await page
    .getByRole('region', { name: 'Intervalles' })
    .getByRole('link', { name: /Passer le test/ })
    .click();
  await page.getByRole('button', { name: 'Commencer le test' }).click();

  await answerTier(page, () => true);
  await expect(page.getByText('Palier 1 réussi.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await answerTier(page, (i) => i !== 0);
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await answerTier(page, (i) => i > 1);

  await expect(page.getByRole('heading', { name: '4 étapes validées' })).toBeVisible();
  await expect(page.getByText(/Palier 3 non réussi/)).toBeVisible();
  await expect(page.getByText(/Intervalles ascendants · étape 5/)).toBeVisible();

  await page.getByRole('link', { name: 'Voir le parcours' }).click();
  await expect(
    page.getByRole('region', { name: 'Intervalles' }).getByText('4 / 30 étapes validées'),
  ).toBeVisible();
});
