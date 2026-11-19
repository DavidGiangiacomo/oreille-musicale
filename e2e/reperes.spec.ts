import { expect, test } from '@playwright/test';

// Chansons repères (§6.1) : suggestion affichée en découverte, remplacée par la sienne.
test('affiche les repères et accepte les siens', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Écouter un accord/ }).click();
  await page.getByRole('button', { name: "C'est parti" }).click();

  await page.goto('./#/etape/int.asc.01');
  await expect(page.getByText('Repère : When the Saints Go Marching In')).toBeVisible();

  await page.goto('./#/reperes');
  await page
    .getByRole('region', { name: 'Tierce majeure (3M)' })
    .getByLabel('en montant')
    .fill('Kumbaya');
  await page.goto('./#/etape/int.asc.01');
  await expect(page.getByText('Repère : Kumbaya')).toBeVisible();

  await page.goto('./#/reperes');
  await page
    .getByLabel('Afficher les repères pendant la découverte et après chaque réponse')
    .uncheck();
  await page.goto('./#/etape/int.asc.01');
  await expect(page.getByRole('heading', { name: 'Découverte' })).toBeVisible();
  await expect(page.getByText(/Repère :/)).toHaveCount(0);
});
