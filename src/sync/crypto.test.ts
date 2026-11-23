import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decodeSyncKey,
  deriveSyncKeys,
  encodeSyncKey,
  generateSecret,
  seal,
  sealedId,
  unseal,
} from './crypto';

const secretArb = fc
  .uint8Array({ minLength: 16, maxLength: 16 })
  .map((bytes) => new Uint8Array(bytes));

describe('clé de synchronisation', () => {
  it('se relit à l’identique, avec ou sans tirets, en minuscules', () => {
    fc.assert(
      fc.property(secretArb, (secret) => {
        const key = encodeSyncKey(secret);
        expect(key).toMatch(/^[0-9A-Z*~$=]{4}(-[0-9A-Z*~$=]{1,4}){6}$/);
        expect(decodeSyncKey(key)).toEqual(secret);
        expect(decodeSyncKey(key.toLowerCase().replace(/-/g, ' '))).toEqual(secret);
      }),
    );
  });

  it('accepte O pour 0 et I ou L pour 1', () => {
    const secret = new Uint8Array(16);
    const key = encodeSyncKey(secret);
    expect(key.startsWith('0000')).toBe(true);
    expect(decodeSyncKey(key.replace(/0/g, 'O'))).toEqual(secret);
  });

  it('refuse une clé mal recopiée', () => {
    fc.assert(
      fc.property(secretArb, fc.nat(), (secret, n) => {
        const chars = encodeSyncKey(secret).replace(/-/g, '').split('');
        const i = n % 26;
        const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
        chars[i] = alphabet[(alphabet.indexOf(chars[i]!) + 1) % 32]!;
        expect(decodeSyncKey(chars.join(''))).toBeNull();
      }),
    );
    expect(decodeSyncKey('ABCD')).toBeNull();
    expect(decodeSyncKey('')).toBeNull();
  });

  it('crée un secret différent à chaque fois', () => {
    expect(encodeSyncKey(generateSecret())).not.toBe(encodeSyncKey(generateSecret()));
  });
});

describe('chiffrement', () => {
  it('dérive les mêmes identifiants du même secret, d’autres d’un autre secret', async () => {
    const secret = generateSecret();
    const [a, b, other] = await Promise.all([
      deriveSyncKeys(secret),
      deriveSyncKeys(new Uint8Array(secret)),
      deriveSyncKeys(generateSecret()),
    ]);
    expect(a.bucket).toBe(b.bucket);
    expect(a.token).toBe(b.token);
    expect(a.bucket).toMatch(/^[0-9a-f]{32}$/);
    expect(other.bucket).not.toBe(a.bucket);
    expect(await sealedId(a, 'attempt:x')).toBe(await sealedId(b, 'attempt:x'));
    expect(await sealedId(a, 'attempt:x')).not.toBe(await sealedId(other, 'attempt:x'));
  });

  it('déchiffre ce qu’il a chiffré, et rien d’autre', async () => {
    const keys = await deriveSyncKeys(generateSecret());
    const content = { v: 1, record: { kind: 'event', value: { id: 'e', note: 'é ♯' } } };
    const sealed = await seal(keys, 'event:e', content);
    expect(sealed.data).not.toContain('event');
    expect(await unseal(keys, sealed)).toEqual(content);

    // Autre clé, bloc altéré, ou bloc déplacé sous un autre identifiant.
    expect(await unseal(await deriveSyncKeys(generateSecret()), sealed)).toBeNull();
    const flipped = sealed.data.at(-1) === 'A' ? 'B' : 'A';
    expect(await unseal(keys, { ...sealed, data: sealed.data.slice(0, -1) + flipped })).toBeNull();
    expect(await unseal(keys, { ...sealed, id: await sealedId(keys, 'event:f') })).toBeNull();
    expect(await unseal(keys, { ...sealed, data: '!!' })).toBeNull();
  });
});
