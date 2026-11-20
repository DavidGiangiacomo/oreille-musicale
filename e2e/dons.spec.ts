import { expect, test } from '@playwright/test';

// Lien de dons (§10.11) : seulement dans « À propos », vers la page Ko-fi du projet.
test('le lien de dons est dans « À propos », vers la page Ko-fi', async ({ page }) => {
  await page.goto('./#/bienvenue');
  await page.getByRole('button', { name: "C'est parti" }).click();
  await page.getByRole('link', { name: /À propos/ }).click();
  const donations = page.getByRole('region', { name: 'Soutenir le projet' });
  await expect(donations.getByRole('link', { name: 'page Ko-fi' })).toHaveAttribute(
    'href',
    'https://ko-fi.com/davidgiangiacomobaudchon',
  );
});
