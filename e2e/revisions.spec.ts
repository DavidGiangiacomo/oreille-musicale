import { expect, test, type Page } from '@playwright/test';

// Scénario du jalon J3 : premier lancement → étape 1 → validation → révision à
// l'échéance, puis duel après un oubli. L'octave, ratée une fois au test, entre en
// révision avec « Difficile » : FSRS la reprogramme deux jours plus tard (« Bien »
// donnerait trois jours).

const NAMES: Record<string, string> = {
  m2: '2m Seconde mineure',
  M2: '2M Seconde majeure',
  m3: '3m Tierce mineure',
  M3: '3M Tierce majeure',
  P4: '4J Quarte juste',
  TT: '4+/5− Triton',
  P5: '5J Quinte juste',
  m6: '6m Sixte mineure',
  M6: '6M Sixte majeure',
  m7: '7m Septième mineure',
  M7: '7M Septième majeure',
  P8: '8J Octave',
};

/** 20 novembre 2026, 9 h (Paris) : jour 0 du scénario. */
const DAY0 = new Date('2026-11-20T09:00:00+01:00');
const dayAfter = (days: number) => new Date(DAY0.getTime() + days * 24 * 3600_000);

declare global {
  interface Window {
    __oreilleReponse?: string;
    __oreilleNumero?: number;
  }
}

/** Questions vues, pour attendre la suivante (outil de test du mode développement). */
let seen = 0;

async function nextQuestion(page: Page): Promise<string> {
  await page.waitForFunction((n) => (window.__oreilleNumero ?? 0) > n, seen);
  const answers = page.getByRole('group', { name: 'Réponses' }).getByRole('button');
  await expect(answers.first()).toBeEnabled();
  seen = await page.evaluate(() => window.__oreilleNumero ?? 0);
  return page.evaluate(() => window.__oreilleReponse ?? '');
}

/** Répond à la question en cours (juste, ou par `wrong`), puis passe à la suite. */
async function answer(page: Page, decide: (item: string) => string = (item) => item) {
  const item = await nextQuestion(page);
  await page.getByRole('button', { name: NAMES[decide(item)], exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Bonne réponse|Non :/ })).toBeVisible();
  await page.keyboard.press('Enter');
  return item;
}

/** Premier lancement, puis étape 1 validée avec une erreur sur l'octave. */
async function validateFirstStep(page: Page) {
  seen = 0;
  await page.clock.install({ time: DAY0 });
  await page.goto('./');
  await expect(page).toHaveURL(/#\/bienvenue/);
  await page.getByRole('button', { name: /Écouter un accord/ }).click();
  await page.getByRole('button', { name: "C'est parti" }).click();

  // La séance du jour mène à l'étape 1 : rien à réviser encore.
  await expect(page.getByRole('heading', { name: 'Séance du jour' })).toBeVisible();
  await page.getByRole('button', { name: 'Commencer la séance du jour' }).click();
  await expect(page).toHaveURL(/#\/etape\/int\.asc\.01/);
  await page.getByRole('button', { name: 'Je connais déjà : passer directement le test' }).click();

  let octaveMissed = false;
  while (!(await page.getByRole('heading', { name: /Étape validée/ }).isVisible())) {
    await answer(page, (item) => {
      if (item !== 'P8' || octaveMissed) return item;
      octaveMissed = true;
      return 'P5';
    });
  }
  expect(octaveMissed).toBe(true);
  await page.getByRole('link', { name: 'Parcours' }).click();
  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(
    page.getByText('Aucune révision aujourd’hui ; la prochaine, dans 2 jours.'),
  ).toBeVisible();
}

/** Deux jours plus tard : l'octave est due, les deux autres pas encore. */
async function startReviewDay(page: Page) {
  await page.clock.setSystemTime(dayAfter(2));
  await page.reload();
  seen = 0;
  const daily = page.getByRole('region', { name: 'Séance du jour' });
  await expect(daily.getByText(/^1 révision · /)).toBeVisible();
  await daily.getByRole('button', { name: 'Commencer la séance du jour' }).click();
  await expect(page).toHaveURL(/#\/seance/);
  await expect(
    page.getByRole('heading', { name: 'Révisions · Intervalles ascendants' }),
  ).toBeVisible();
}

test('révision à l’échéance après la validation', async ({ page }) => {
  await validateFirstStep(page);
  await startReviewDay(page);

  const asked: string[] = [];
  while (!(await page.getByRole('heading', { name: 'Séance terminée' }).isVisible())) {
    asked.push(await answer(page));
  }
  // 3 questions sur l'octave, mêlées à une distractrice.
  expect(asked.filter((item) => item === 'P8')).toHaveLength(3);
  expect(asked).toHaveLength(4);

  const octave = page.getByRole('listitem').filter({ hasText: 'Octave ascendante' });
  await expect(octave).toContainText(/Bien|Facile/);
  await expect(octave).toContainText(/prochaine révision dans \d+ jours/);

  await page.getByRole('link', { name: "Retour à l'accueil" }).click();
  // La tierce et la quinte, entrées en « Bien », sont dues le lendemain (jour 3).
  await expect(page.getByText('Aucune révision aujourd’hui ; la prochaine, demain.')).toBeVisible();
});

test('un oubli en révision programme un duel', async ({ page }) => {
  await validateFirstStep(page);
  await startReviewDay(page);

  while (!(await page.getByRole('heading', { name: 'Séance terminée' }).isVisible())) {
    await answer(page, (item) => (item === 'P8' ? 'P5' : item));
  }
  await expect(page.getByRole('listitem').filter({ hasText: 'Octave ascendante' })).toContainText(
    'À revoir',
  );

  await page.getByRole('link', { name: "Retour à l'accueil" }).click();
  const daily = page.getByRole('region', { name: 'Séance du jour' });
  await expect(daily.getByText(/1 duel/)).toBeVisible();
  await daily.getByRole('button', { name: 'Commencer la séance du jour' }).click();
  await expect(page.getByRole('heading', { name: 'Duel · 5J / 8J' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Réponses' }).getByRole('button')).toHaveCount(2);

  // Écoute comparée systématique : même après une bonne réponse.
  for (let i = 0; i < 10; i++) {
    const item = await nextQuestion(page);
    await page.getByRole('button', { name: NAMES[item], exact: true }).click();
    await expect(page.getByRole('button', { name: /^Écouter (5J|8J)$/ })).toBeVisible();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('heading', { name: 'Séance terminée' })).toBeVisible();
  await expect(page.getByText('5J / 8J : 10 / 10')).toBeVisible();
});
