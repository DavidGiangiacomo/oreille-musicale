// Chiffrement de bout en bout de la synchronisation (docs/DESIGN.md §10.8).
//
// Tout part d'un secret de 128 bits, créé sur le premier appareil et recopié sur
// les autres sous forme d'une clé de synchronisation lisible. Le serveur n'en
// connaît que deux dérivés : l'identifiant du dossier et le jeton d'accès. Le
// contenu des enregistrements, et même leur nature, lui restent illisibles.

const SECRET_BYTES = 16;
const IV_BYTES = 12;
/** Alphabet de Crockford : sans I, L, O ni U, pour éviter les confusions à la saisie. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CHECK_SYMBOLS = `${ALPHABET}*~$=U`;

export interface SyncKeys {
  /** Identifiant du dossier sur le serveur, en hexadécimal. */
  bucket: string;
  /** Jeton d'accès au dossier, envoyé au serveur. */
  token: string;
  /** Chiffrement des enregistrements (AES-GCM 256 bits). */
  encryption: CryptoKey;
  /** Identifiants opaques des enregistrements (HMAC-SHA-256). */
  naming: CryptoKey;
}

/** Enregistrement tel que le serveur le voit : un identifiant opaque et un bloc chiffré. */
export interface SealedRecord {
  id: string;
  data: string;
}

/** Octets sur un tampon ordinaire, comme les attend WebCrypto. */
type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBigInt(bytes: Uint8Array): bigint {
  return bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Bytes | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Nouveau secret aléatoire, pour le premier appareil. */
export function generateSecret(): Bytes {
  return crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
}

/**
 * Clé de synchronisation lisible : 26 caractères en base 32 de Crockford, plus un
 * caractère de contrôle contre les fautes de frappe, par groupes de 4 :
 * « 7KQ3-M2XA-… ».
 */
export function encodeSyncKey(secret: Bytes): string {
  const value = toBigInt(secret);
  let chars = '';
  for (let i = 0; i < 26; i++) {
    chars = ALPHABET[Number((value >> BigInt(i * 5)) & 31n)] + chars;
  }
  chars += CHECK_SYMBOLS[Number(value % 37n)];
  return chars.match(/.{1,4}/g)!.join('-');
}

/**
 * Relit une clé saisie : majuscules ou minuscules, avec ou sans tirets ni espaces,
 * O pour 0 et I ou L pour 1 acceptés. Null si la clé est incomplète ou mal recopiée.
 */
export function decodeSyncKey(text: string): Bytes | null {
  const chars = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (chars.length !== 27) return null;
  let value = 0n;
  for (const char of chars.slice(0, 26)) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    value = (value << 5n) | BigInt(digit);
  }
  if (value >> 128n !== 0n) return null;
  if (CHECK_SYMBOLS[Number(value % 37n)] !== chars[26]) return null;
  const secret = new Uint8Array(SECRET_BYTES);
  for (let i = SECRET_BYTES - 1; i >= 0; i--) {
    secret[i] = Number(value & 255n);
    value >>= 8n;
  }
  return secret;
}

/** Dérive les clés et identifiants du secret (HKDF-SHA-256, un usage par libellé). */
export async function deriveSyncKeys(secret: Bytes): Promise<SyncKeys> {
  const master = await crypto.subtle.importKey('raw', secret, 'HKDF', false, [
    'deriveBits',
    'deriveKey',
  ]);
  const params = (label: string): HkdfParams => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: encoder.encode('oreille-musicale/sync/v1'),
    info: encoder.encode(label),
  });
  const bits = async (label: string, length: number) =>
    new Uint8Array(await crypto.subtle.deriveBits(params(label), master, length));
  const [bucket, token, encryption, naming] = await Promise.all([
    bits('bucket', 128),
    bits('token', 256),
    crypto.subtle.deriveKey(params('encryption'), master, { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]),
    crypto.subtle.deriveKey(
      params('naming'),
      master,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign'],
    ),
  ]);
  return { bucket: toHex(bucket), token: toBase64Url(token), encryption, naming };
}

/** Identifiant opaque d'une clé d'enregistrement : le serveur dédoublonne sans la connaître. */
export async function sealedId(keys: SyncKeys, recordKey: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', keys.naming, encoder.encode(recordKey));
  return toBase64Url(new Uint8Array(mac).slice(0, 16));
}

/**
 * Chiffre un contenu JSON. L'identifiant sert de données associées : un bloc
 * déplacé sous un autre identifiant ne se déchiffre plus.
 */
export async function seal(
  keys: SyncKeys,
  recordKey: string,
  content: unknown,
): Promise<SealedRecord> {
  const id = await sealedId(keys, recordKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(id) },
    keys.encryption,
    encoder.encode(JSON.stringify(content)),
  );
  const data = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  data.set(iv);
  data.set(new Uint8Array(ciphertext), IV_BYTES);
  return { id, data: toBase64Url(data) };
}

/** Déchiffre un enregistrement ; null s'il a été altéré ou chiffré avec une autre clé. */
export async function unseal(keys: SyncKeys, sealed: SealedRecord): Promise<unknown> {
  const data = fromBase64Url(sealed.data);
  if (!data || data.length <= IV_BYTES) return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: data.slice(0, IV_BYTES), additionalData: encoder.encode(sealed.id) },
      keys.encryption,
      data.slice(IV_BYTES),
    );
    return JSON.parse(decoder.decode(plaintext));
  } catch {
    return null;
  }
}
