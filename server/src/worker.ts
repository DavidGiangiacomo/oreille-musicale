// Serveur de synchronisation d'Oreille musicale (docs/DESIGN.md §10.8) : un
// Cloudflare Worker et une base D1. Il range des blocs chiffrés par dossier, sans
// pouvoir les lire ; le protocole est décrit dans src/sync/protocol.ts.
import {
  BUCKET_PATTERN,
  MAX_BUCKET_RECORDS,
  MAX_PULL_RECORDS,
  MAX_PUSH_RECORDS,
  MAX_RECORD_LENGTH,
  RECORD_DATA_PATTERN,
  RECORD_ID_PATTERN,
  TOKEN_PATTERN,
  type PullResponse,
  type PushResponse,
} from '../../src/sync/protocol';

export interface Env {
  DB: D1Database;
}

/**
 * Les requêtes s'authentifient par un jeton dans un en-tête, jamais par un cookie :
 * on peut donc accepter toutes les origines (web, application Android, instance
 * auto-hébergée de l'appli).
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const error = (status: number, message: string) => json({ error: message }, status);

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Comparaison en temps constant de deux empreintes de même longueur. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function bearer(request: Request): string | null {
  const match = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '');
  return match && TOKEN_PATTERN.test(match[1]!) ? match[1]! : null;
}

type Access = 'granted' | 'missing' | 'denied';

/** Le jeton ouvre-t-il ce dossier ? `missing` si le dossier n'existe pas encore. */
async function access(db: D1Database, bucket: string, tokenHash: string): Promise<Access> {
  const row = await db
    .prepare('SELECT token_hash FROM buckets WHERE id = ?')
    .bind(bucket)
    .first<{ token_hash: string }>();
  if (!row) return 'missing';
  return sameHash(row.token_hash, tokenHash) ? 'granted' : 'denied';
}

interface IncomingRecord {
  id: string;
  data: string;
}

function parsePush(body: unknown): IncomingRecord[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const records = (body as { records?: unknown }).records;
  if (!Array.isArray(records) || records.length > MAX_PUSH_RECORDS) return null;
  const valid = records.every(
    (record: unknown) =>
      typeof record === 'object' &&
      record !== null &&
      typeof (record as IncomingRecord).id === 'string' &&
      typeof (record as IncomingRecord).data === 'string' &&
      RECORD_ID_PATTERN.test((record as IncomingRecord).id) &&
      (record as IncomingRecord).data.length <= MAX_RECORD_LENGTH &&
      RECORD_DATA_PATTERN.test((record as IncomingRecord).data),
  );
  return valid ? (records as IncomingRecord[]) : null;
}

async function push(request: Request, db: D1Database, bucket: string, tokenHash: string) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, 'Corps JSON attendu');
  }
  const records = parsePush(body);
  if (!records) return error(400, 'Enregistrements invalides');

  // Premier envoi : le dossier est créé et lié à ce jeton.
  await db
    .prepare('INSERT OR IGNORE INTO buckets (id, token_hash, created_at) VALUES (?, ?, ?)')
    .bind(bucket, tokenHash, Date.now())
    .run();
  if ((await access(db, bucket, tokenHash)) !== 'granted') return error(403, 'Jeton refusé');
  if (records.length === 0) return json({ accepted: 0 } satisfies PushResponse);

  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM records WHERE bucket = ?')
    .bind(bucket)
    .first<{ n: number }>();
  if ((count?.n ?? 0) + records.length > MAX_BUCKET_RECORDS) {
    return error(413, 'Dossier plein');
  }

  // Une transaction : chaque bloc nouveau prend le numéro suivant du dossier ; un
  // identifiant déjà connu est ignoré.
  const insert = db.prepare(
    `INSERT OR IGNORE INTO records (bucket, seq, id, data)
     VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM records WHERE bucket = ?), ?, ?)`,
  );
  const results = await db.batch(
    records.map(({ id, data }) => insert.bind(bucket, bucket, id, data)),
  );
  const accepted = results.reduce((sum, result) => sum + (result.meta.changes ?? 0), 0);
  return json({ accepted } satisfies PushResponse);
}

async function pull(url: URL, db: D1Database, bucket: string, tokenHash: string) {
  const after = Number(url.searchParams.get('after') ?? '0');
  const limit = Number(url.searchParams.get('limit') ?? String(MAX_PUSH_RECORDS));
  if (!Number.isInteger(after) || after < 0) return error(400, 'Paramètre « after » invalide');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PULL_RECORDS) {
    return error(400, 'Paramètre « limit » invalide');
  }
  const state = await access(db, bucket, tokenHash);
  if (state === 'denied') return error(403, 'Jeton refusé');
  if (state === 'missing') return json({ records: [], more: false } satisfies PullResponse);

  const { results } = await db
    .prepare('SELECT seq, id, data FROM records WHERE bucket = ? AND seq > ? ORDER BY seq LIMIT ?')
    .bind(bucket, after, limit + 1)
    .all<{ seq: number; id: string; data: string }>();
  return json({
    records: results.slice(0, limit),
    more: results.length > limit,
  } satisfies PullResponse);
}

async function remove(db: D1Database, bucket: string, tokenHash: string) {
  const state = await access(db, bucket, tokenHash);
  if (state === 'denied') return error(403, 'Jeton refusé');
  if (state === 'granted') {
    await db.batch([
      db.prepare('DELETE FROM records WHERE bucket = ?').bind(bucket),
      db.prepare('DELETE FROM buckets WHERE id = ?').bind(bucket),
    ]);
  }
  return new Response(null, { status: 204, headers: CORS });
}

const ROUTE = /^\/v1\/buckets\/([^/]+)(\/records)?$/;

export async function handle(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  if (url.pathname === '/v1/health') return json({ ok: true });

  const route = ROUTE.exec(url.pathname);
  if (!route) return error(404, 'Introuvable');
  const bucket = route[1]!;
  const records = route[2] !== undefined;
  if (!BUCKET_PATTERN.test(bucket)) return error(404, 'Introuvable');
  const token = bearer(request);
  if (!token) return error(401, 'Jeton manquant');
  const tokenHash = await sha256(token);

  try {
    if (records && request.method === 'POST') return await push(request, env.DB, bucket, tokenHash);
    if (records && request.method === 'GET') return await pull(url, env.DB, bucket, tokenHash);
    if (!records && request.method === 'DELETE') return await remove(env.DB, bucket, tokenHash);
    return error(405, 'Méthode non prise en charge');
  } catch (cause) {
    console.error('Erreur du serveur de synchronisation', cause);
    return error(500, 'Erreur interne');
  }
}

export default { fetch: handle } satisfies ExportedHandler<Env>;
