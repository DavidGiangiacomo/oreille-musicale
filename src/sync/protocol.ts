// Protocole entre l'appli et le serveur de synchronisation (docs/DESIGN.md §10.8),
// partagé par le client (sync/httpTransport.ts) et le serveur (server/).
//
//   POST   /v1/buckets/:dossier/records   { records: [{ id, data }] } → { accepted }
//   GET    /v1/buckets/:dossier/records?after=N&limit=M → { records: [{ seq, id, data }], more }
//   DELETE /v1/buckets/:dossier                          → 204, dossier effacé
//
// Chaque requête porte `Authorization: Bearer <jeton>`. Le dossier est créé au
// premier envoi, lié à l'empreinte du jeton ; un autre jeton est refusé (403).

export const BUCKET_PATTERN = /^[0-9a-f]{32}$/;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const RECORD_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
export const RECORD_DATA_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Enregistrements par envoi. */
export const MAX_PUSH_RECORDS = 200;
/** Enregistrements par lecture. */
export const MAX_PULL_RECORDS = 500;
/** Taille d'un bloc chiffré, en caractères base64url. */
export const MAX_RECORD_LENGTH = 16_384;
/** Enregistrements par dossier : des années de pratique quotidienne. */
export const MAX_BUCKET_RECORDS = 200_000;

export const recordsPath = (bucket: string) => `/v1/buckets/${bucket}/records`;
export const bucketPath = (bucket: string) => `/v1/buckets/${bucket}`;

export interface PushBody {
  records: { id: string; data: string }[];
}

export interface PushResponse {
  /** Enregistrements nouveaux pour le serveur (les déjà connus sont ignorés). */
  accepted: number;
}

export interface PullResponse {
  records: { seq: number; id: string; data: string }[];
  more: boolean;
}
