import { expect, test, type Page } from '@playwright/test';
import { PREVIEW_PORT } from '../playwright.config';

// Timbres (§5.1), avec le vrai moteur audio de la version publiée : choisir un timbre
// charge tous ses échantillons et le fait entendre.
const PREVIEW = `http://localhost:${PREVIEW_PORT}/`;

async function choose(page: Page, label: string, folder: string, count: number) {
  const loaded = new Set<string>();
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.includes(`/samples/${folder}/`) && response.ok()) loaded.add(url.pathname);
  });
  const timbre = page.getByRole('group', { name: 'Timbre' }).getByRole('button', { name: label });
  await timbre.click();
  await expect(timbre).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => loaded.size).toBe(count);
  await expect(page.getByText(/Chargement d/)).toHaveCount(0);
  await expect(page.getByText(/n’a pas pu être chargé/)).toHaveCount(0);
}

test('charge et fait entendre le vibraphone et les cordes', async ({ page }) => {
  await page.goto(PREVIEW);
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page.getByRole('heading', { name: 'Séance du jour' })).toBeVisible();

  await choose(page, 'Vibraphone', 'vibraphone', 10);
  await choose(page, 'Cordes', 'strings', 17);

  // Le choix est retenu.
  await page.reload();
  await expect(
    page.getByRole('group', { name: 'Timbre' }).getByRole('button', { name: 'Cordes' }),
  ).toHaveAttribute('aria-pressed', 'true');
});
