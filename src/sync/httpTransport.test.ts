import { describe, expect, it } from 'vitest';
import { SyncUnreachable } from './engine';
import { httpTransport, SyncServerError } from './httpTransport';

const access = { url: 'https://sync.example.org/', bucket: 'f'.repeat(32), token: 'T'.repeat(43) };

describe('accès HTTP au serveur de synchronisation', () => {
  it('envoie le jeton et lit les pages à l’adresse attendue', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return Response.json({ records: [{ seq: 3, id: 'i', data: 'd' }], more: false });
    };
    const page = await httpTransport(access, fetchImpl).pull(2, 50);
    expect(page).toEqual({ records: [{ seq: 3, id: 'i', data: 'd' }], more: false });
    expect(calls[0]?.url).toBe(
      `https://sync.example.org/v1/buckets/${access.bucket}/records?after=2&limit=50`,
    );
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toBe(
      `Bearer ${access.token}`,
    );
  });

  it('distingue un serveur injoignable d’un refus', async () => {
    const offline: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(httpTransport(access, offline).push([])).rejects.toBeInstanceOf(SyncUnreachable);
    const refused: typeof fetch = async () => new Response(null, { status: 403 });
    await expect(httpTransport(access, refused).pull(0, 10)).rejects.toEqual(
      new SyncServerError(403),
    );
  });
});
