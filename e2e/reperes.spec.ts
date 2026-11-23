import { expect, test } from '@playwright/test';

// Chansons repères (§6.1) : suggestions affichées en découverte, remplacées par la sienne.
test('affiche les repères et accepte les siens', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Écouter un accord/ }).click();
  await page.getByRole('button', { name: "C'est parti" }).click();

  await page.goto('./#/etape/int.asc.01');
  const suggestions = page.getByText('Repères : When the Saints Go Marching In');
  await expect(suggestions).toBeVisible();
  await expect(suggestions).toContainText('Where Is My Mind? (Pixies), riff de guitare');

  await page.goto('./#/reperes');
  const majorThird = page.getByRole('region', { name: 'Tierce majeure (3M)' });
  await expect(majorThird.getByText('Suggestions : When the Saints Go Marching In')).toBeVisible();
  await majorThird.getByLabel('en montant').fill('Ma chanson');
  await page.goto('./#/etape/int.asc.01');
  await expect(page.getByText('Repère : Ma chanson')).toBeVisible();
  await expect(page.getByText(/When the Saints/)).toHaveCount(0);

  await page.goto('./#/reperes');
  await page
    .getByLabel('Afficher les repères pendant la découverte et après chaque réponse')
    .uncheck();
  await page.goto('./#/etape/int.asc.01');
  await expect(page.getByRole('heading', { name: 'Découverte' })).toBeVisible();
  await expect(page.getByText(/Repères? :/)).toHaveCount(0);
});
