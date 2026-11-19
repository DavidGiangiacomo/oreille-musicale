import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Audit d'accessibilité (WCAG 2.1 AA, §9.6) des écrans principaux, en clair et en sombre.

const SCREENS: { name: string; path: string; ready: RegExp | string }[] = [
  { name: 'accueil', path: './', ready: 'Séance du jour' },
  { name: 'parcours', path: './#/parcours', ready: 'Parcours' },
  { name: 'étape', path: './#/etape/int.asc.01', ready: 'Intervalles ascendants · étape 1' },
  { name: 'statistiques', path: './#/statistiques', ready: 'Statistiques' },
  { name: 'positionnement', path: './#/positionnement', ready: 'Tests de positionnement' },
  { name: 'repères', path: './#/reperes', ready: 'Mes chansons repères' },
  { name: 'à propos', path: './#/a-propos', ready: 'À propos' },
];

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  // Un résumé court par règle : nombre d'éléments, le premier, et le détail d'axe.
  const summary = results.violations.map((v) => {
    const first = v.nodes[0];
    const detail = first?.any[0]?.message ?? first?.failureSummary ?? '';
    return `${v.id} (${v.impact}) ×${v.nodes.length} : ${first?.target.join(' ')} — ${detail}`;
  });
  expect.soft(summary).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test(`écrans principaux sans défaut d’accessibilité (${theme === 'light' ? 'clair' : 'sombre'})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('./#/bienvenue');
    await expect(page.getByRole('heading', { name: 'Bienvenue !' })).toBeVisible();
    await audit(page);
    await page.getByRole('button', { name: /Écouter un accord/ }).click();
    await expect(page.getByText(/Le son fonctionne/)).toBeVisible();
    await page.getByRole('button', { name: "C'est parti" }).click();
    for (const screen of SCREENS) {
      await page.goto(screen.path);
      await expect(page.getByRole('heading', { name: screen.ready }).first()).toBeVisible();
      await test.step(screen.name, () => audit(page));
    }

    // La découverte, puis une question et son feedback (erreur), avec le mini-clavier.
    // (Le premier écran a rechargé la page : le son est à réactiver.)
    await page.goto('./#/etape/int.asc.01');
    await page.getByRole('button', { name: 'Activer le son et découvrir' }).click();
    await expect(page.getByRole('heading', { name: 'Découverte' })).toBeVisible();
    await test.step('découverte', () => audit(page));
    await page.getByRole('button', { name: /Continuer : entraînement/ }).click();
    const answers = page.getByRole('group', { name: 'Réponses' }).getByRole('button');
    await expect(answers.first()).toBeEnabled();
    const expected = await page.evaluate(
      () => (window as unknown as { __oreilleReponse?: string }).__oreilleReponse,
    );
    await answers
      .filter({ hasNotText: expected === 'P8' ? '8J' : '5J' })
      .last()
      .click();
    await expect(page.getByRole('status').filter({ hasText: /Bonne réponse|Non :/ })).toBeVisible();
    await test.step('feedback', () => audit(page));

    // Les statistiques avec des données : tableaux de maîtrise, confusions, courbes.
    await page.goto('./#/statistiques');
    await expect(page.getByRole('heading', { name: 'Maîtrise' })).toBeVisible();
    await test.step('statistiques remplies', () => audit(page));
  });
}

test('le changement d’écran met à jour le titre et place le focus sur le titre', async ({
  page,
}) => {
  await page.goto('./#/bienvenue');
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page).toHaveTitle('Oreille musicale');
  await page.getByRole('link', { name: 'Statistiques' }).click();
  await expect(page).toHaveTitle('Statistiques · Oreille musicale');
  await expect(page.getByRole('heading', { level: 1, name: 'Statistiques' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Accueil' })).not.toBeFocused();
});
