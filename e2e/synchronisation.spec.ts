import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { MemorySyncServer, SyncAccessDenied } from '../src/sync/memoryServer';

// Synchronisation entre deux appareils (§10.8) : deux navigateurs indépendants et
// un serveur simulé, au comportement du vrai, branché sur l'adresse de test.

declare global {
  interface Window {
    __oreilleReponse?: string;
    __oreilleNumero?: number;
  }
}

const NAMES: Record<string, string> = {
  M3: '3M Tierce majeure',
  P5: '5J Quinte juste',
  P8: '8J Octave',
};

/** Branche un navigateur sur le serveur simulé. */
async function connect(context: BrowserContext, server: MemorySyncServer) {
  await context.route('https://sync.test/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const match = /^\/v1\/buckets\/([^/]+)(\/records)?$/.exec(url.pathname);
    const token = /^Bearer (.+)$/.exec((await request.headerValue('authorization')) ?? '')?.[1];
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      });
      return;
    }
    if (!match || !token) {
      await route.fulfill({ status: 404, headers: cors });
      return;
    }
    const transport = server.transport(match[1]!, token);
    try {
      if (request.method() === 'POST') {
        const { records } = request.postDataJSON() as {
          records: { id: string; data: string }[];
        };
        await transport.push(records);
        await route.fulfill({ status: 200, headers: cors, json: { accepted: records.length } });
      } else if (request.method() === 'GET') {
        const page = await transport.pull(
          Number(url.searchParams.get('after')),
          Number(url.searchParams.get('limit')),
        );
        await route.fulfill({ status: 200, headers: cors, json: page });
      } else {
        await route.fulfill({ status: 204, headers: cors });
      }
    } catch (error) {
      await route.fulfill({ status: error instanceof SyncAccessDenied ? 403 : 500, headers: cors });
    }
  });
}

/** Audit d'accessibilité (WCAG 2.1 AA) de la carte de synchronisation. */
async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('section[aria-labelledby="synchronisation"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id} : ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

async function onboard(page: Page) {
  await page.goto('./#/bienvenue');
  await page.getByRole('button', { name: /Écouter un accord/ }).click();
  await expect(page.getByText(/Le son fonctionne/)).toBeVisible();
  await page.getByRole('button', { name: "C'est parti" }).click();
  await expect(page.getByRole('heading', { name: 'Séance du jour' })).toBeVisible();
}

async function validateFirstStep(page: Page) {
  await page.goto('./#/etape/int.asc.01');
  await page.getByRole('button', { name: 'Je connais déjà : passer directement le test' }).click();
  let seen = 0;
  while (!(await page.getByRole('heading', { name: /Étape validée/ }).isVisible())) {
    await page.waitForFunction((n) => (window.__oreilleNumero ?? 0) > n, seen);
    seen = await page.evaluate(() => window.__oreilleNumero ?? 0);
    const expected = await page.evaluate(() => window.__oreilleReponse ?? '');
    await page.getByRole('button', { name: NAMES[expected], exact: true }).click();
    await page.keyboard.press('Enter');
  }
  await page.goto('./#/parcours');
  await expect(
    page.getByRole('region', { name: 'Intervalles' }).getByText('1 / 30 étapes validées'),
  ).toBeVisible();
}

test('deux appareils reliés par une clé retrouvent la même progression', async ({ browser }) => {
  const server = new MemorySyncServer();
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  await connect(contextA, server);
  await connect(contextB, server);
  const a = await contextA.newPage();
  const b = await contextB.newPage();

  // Premier appareil : une étape validée, puis la synchronisation activée.
  await onboard(a);
  await validateFirstStep(a);
  await a.goto('./#/');
  const syncA = a.getByRole('region', { name: 'Synchronisation' });
  await syncA.getByRole('button', { name: 'Activer la synchronisation' }).click();
  const key = (await syncA.getByText(/^[0-9A-Z]{4}-[0-9A-Z]{4}-/).textContent()) ?? '';
  expect(key).toMatch(/^[0-9A-Z*~$=]{4}(-[0-9A-Z*~$=]{1,4}){6}$/);
  await expect(syncA.getByText(/Dernière synchronisation/)).toBeVisible();
  await audit(a);

  // Second appareil : la clé saisie en minuscules, sans tirets.
  await onboard(b);
  const syncB = b.getByRole('region', { name: 'Synchronisation' });
  await syncB.getByRole('button', { name: 'J’ai déjà une clé' }).click();
  await syncB.getByLabel('Clé de synchronisation').fill('ABCD');
  await syncB.getByRole('button', { name: 'Relier cet appareil' }).click();
  await expect(syncB.getByRole('alert')).toHaveText('Cette clé est incomplète ou mal recopiée.');
  await audit(b);
  await syncB.getByLabel('Clé de synchronisation').fill(key.toLowerCase().replace(/-/g, ''));
  await syncB.getByRole('button', { name: 'Relier cet appareil' }).click();
  await expect(syncB.getByText(/Dernière synchronisation/)).toBeVisible();

  await syncB.getByRole('button', { name: 'Désactiver sur cet appareil' }).click();
  await audit(b);
  await syncB.getByRole('button', { name: 'Annuler' }).click();

  await b.goto('./#/parcours');
  await expect(
    b.getByRole('region', { name: 'Intervalles' }).getByText('1 / 30 étapes validées'),
  ).toBeVisible();
  await contextA.close();
  await contextB.close();
});
