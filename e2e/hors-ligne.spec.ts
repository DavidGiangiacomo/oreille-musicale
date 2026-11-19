import { expect, test } from '@playwright/test';
import { PREVIEW_PORT } from '../playwright.config';

// Version web publiée (§10.6) : après une première visite, l'appli et les sons
// déjà entendus fonctionnent sans réseau.
const PREVIEW = `http://localhost:${PREVIEW_PORT}/`;

test('fonctionne sans réseau après une première visite', async ({ page, context }) => {
  await page.goto(PREVIEW);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect(page.getByText("L'appli fonctionne maintenant sans connexion.")).toBeVisible();

  // Premier lancement : le test du son charge le piano, mis en cache au passage.
  await page.getByRole('button', { name: /Écouter un accord/ }).click();
  await expect(page.getByText('Le son fonctionne')).toBeVisible();
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page.getByRole('heading', { name: 'Séance du jour' })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Séance du jour' })).toBeVisible();
  // Le piano se recharge depuis le cache : l'étape s'ouvre, son activé.
  await page.getByRole('button', { name: 'Commencer la séance du jour' }).click();
  await expect(page).toHaveURL(/#\/etape\/int\.asc\.01/);
  await expect(page.getByRole('heading', { name: 'Découverte' })).toBeVisible();
  await expect(page.getByText(/pas pu démarrer/)).toHaveCount(0);
});
