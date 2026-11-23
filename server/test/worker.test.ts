import { describe, expect, it } from 'vitest';
import { MAX_PUSH_RECORDS } from '../../src/sync/protocol';
import { handle, type Env } from '../src/worker';
import { SqliteD1 } from './sqliteD1';

const BUCKET = '0123456789abcdef0123456789abcdef';
const TOKEN = 'A'.repeat(43);
const OTHER_TOKEN = 'B'.repeat(43);

function server() {
  const d1 = new SqliteD1();
  const env = { DB: d1 } as unknown as Env;
  const call = (method: string, path: string, init: { token?: string; body?: unknown } = {}) =>
    handle(
      new Request(`https://sync.test${path}`, {
        method,
        headers: {
          ...(init.token === undefined ? {} : { Authorization: `Bearer ${init.token}` }),
          ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      }),
      env,
    );
  return { d1, call };
}

const id = (n: number) => `rec${String(n).padStart(19, '0')}`;
const records = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: id(from + i), data: `bloc${from + i}` }));

const path = `/v1/buckets/${BUCKET}/records`;

describe('serveur de synchronisation', () => {
  it('crée le dossier au premier envoi, numérote les blocs et ignore les doublons', async () => {
    const { call } = server();
    let response = await call('POST', path, { token: TOKEN, body: { records: records(1, 3) } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: 3 });

    response = await call('POST', path, { token: TOKEN, body: { records: records(2, 3) } });
    expect(await response.json()).toEqual({ accepted: 1 });

    response = await call('GET', `${path}?after=0&limit=10`, { token: TOKEN });
    const body = (await response.json()) as { records: { seq: number; id: string }[] };
    expect(body.records.map((r) => [r.seq, r.id])).toEqual([
      [1, id(1)],
      [2, id(2)],
      [3, id(3)],
      [4, id(4)],
    ]);
  });

  it('lit par pages à partir d’une position', async () => {
    const { call } = server();
    await call('POST', path, { token: TOKEN, body: { records: records(1, 5) } });
    let response = await call('GET', `${path}?after=1&limit=2`, { token: TOKEN });
    expect(await response.json()).toEqual({
      records: [
        { seq: 2, id: id(2), data: 'bloc2' },
        { seq: 3, id: id(3), data: 'bloc3' },
      ],
      more: true,
    });
    response = await call('GET', `${path}?after=3&limit=2`, { token: TOKEN });
    expect(((await response.json()) as { more: boolean }).more).toBe(false);
  });

  it('refuse un autre jeton, et ne révèle rien d’un dossier inexistant', async () => {
    const { call } = server();
    await call('POST', path, { token: TOKEN, body: { records: records(1, 1) } });
    expect((await call('GET', `${path}?after=0`, { token: OTHER_TOKEN })).status).toBe(403);
    expect(
      (await call('POST', path, { token: OTHER_TOKEN, body: { records: records(9, 1) } })).status,
    ).toBe(403);
    expect((await call('DELETE', `/v1/buckets/${BUCKET}`, { token: OTHER_TOKEN })).status).toBe(
      403,
    );

    const empty = `/v1/buckets/${'f'.repeat(32)}/records?after=0`;
    expect(await (await call('GET', empty, { token: OTHER_TOKEN })).json()).toEqual({
      records: [],
      more: false,
    });
    expect((await call('GET', `${path}?after=0`)).status).toBe(401);
    expect((await call('GET', `${path}?after=0`, { token: 'court' })).status).toBe(401);
  });

  it('vérifie ce qu’on lui envoie', async () => {
    const { call } = server();
    const post = (body: unknown) => call('POST', path, { token: TOKEN, body });
    expect((await post({ records: records(1, MAX_PUSH_RECORDS + 1) })).status).toBe(400);
    expect((await post({ records: [{ id: 'trop-court', data: 'x' }] })).status).toBe(400);
    expect((await post({ records: [{ id: id(1), data: 'pas du base64url !' }] })).status).toBe(400);
    expect((await post({ records: [{ id: id(1), data: 'x'.repeat(20_000) }] })).status).toBe(400);
    expect((await post({ autre: 1 })).status).toBe(400);
    expect((await call('GET', `${path}?after=-1`, { token: TOKEN })).status).toBe(400);
    expect((await call('GET', `${path}?limit=0`, { token: TOKEN })).status).toBe(400);
    expect((await call('GET', '/v1/buckets/PAS-UN-DOSSIER/records', { token: TOKEN })).status).toBe(
      404,
    );
    expect((await call('PUT', path, { token: TOKEN })).status).toBe(405);
  });

  it('efface un dossier et tout son contenu', async () => {
    const { call, d1 } = server();
    await call('POST', path, { token: TOKEN, body: { records: records(1, 3) } });
    const response = await call('DELETE', `/v1/buckets/${BUCKET}`, { token: TOKEN });
    expect(response.status).toBe(204);
    expect(d1.db.prepare('SELECT COUNT(*) AS n FROM records').get()).toEqual({ n: 0 });
    expect(d1.db.prepare('SELECT COUNT(*) AS n FROM buckets').get()).toEqual({ n: 0 });
    // Le dossier peut ensuite être recréé, avec n'importe quel jeton.
    expect(
      (await call('POST', path, { token: OTHER_TOKEN, body: { records: records(1, 1) } })).status,
    ).toBe(200);
  });

  it('répond aux requêtes préalables des navigateurs (CORS)', async () => {
    const { call } = server();
    const response = await call('OPTIONS', path);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    const health = await call('GET', '/v1/health');
    expect(health.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
