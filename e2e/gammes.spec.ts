import { expect, test, type Page } from '@playwright/test';

// Parcours Gammes et Modes (J5) : ouverture par les intervalles, puis les gammes ;
// feedback d'un mode avec sa note caractéristique et son mode de référence.

const NAMES: Record<string, string> = {
  M3: 'Tierce majeure (3M)',
  P5: 'Quinte juste (5J)',
  P8: 'Octave (8J)',
  P4: 'Quarte juste (4J)',
  m3: 'Tierce mineure (3m)',
  major: 'Gamme majeure',
  natmin: 'Mineure naturelle',
  harmin: 'Mineure harmonique',
  ionian: 'Ionien (majeur)',
  aeolian: 'Éolien (mineur)',
  mixolydian: 'Mixolydien (majeur, 7m)',
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

test('gammes, puis modes sur bourdon avec leur note caractéristique', async ({ page }) => {
  seen = 0;
  await page.goto('./');
  await page.getByRole('button', { name: /Écouter un accord/ }).click();
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page.getByRole('heading', { name: 'Séance du jour' })).toBeVisible();

  await page.goto('./#/parcours');
  await expect(
    page
      .getByRole('region', { name: 'Gammes' })
      .getByText("S'ouvre après Intervalles ascendants, étape 3."),
  ).toBeVisible();

  for (const id of ['int.asc.01', 'int.asc.02', 'int.asc.03', 'scl.updown.01', 'scl.updown.02']) {
    await passTest(page, id);
  }
  await passTest(page, 'mod.drone.01');

  // Modes sur bourdon, étape 2 : le mixolydien, comparé à l'ionien.
  await page.goto('./#/etape/mod.drone.02');
  await page.getByRole('button', { name: 'Continuer : comparaison' }).click();
  for (let i = 0; i < 12; i++) {
    const played = await answer(page);
    if (played === 'mixolydian') {
      const feedback = page.locator('section').filter({ has: page.getByRole('status') });
      // La septième mineure, note caractéristique, nommée sur le clavier.
      await expect(page.getByRole('img', { name: /note caractéristique : 7m/ })).toBeVisible();
      await expect(
        feedback.getByRole('button', { name: 'Comparer avec le mode de référence (ionien)' }),
      ).toBeVisible();
      return;
    }
    await page.keyboard.press('Enter');
  }
  throw new Error('Le mixolydien n’a jamais été posé');
});
