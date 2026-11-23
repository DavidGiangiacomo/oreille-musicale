// Synchronisation entre appareils (docs/DESIGN.md §10.8) : ce qui s'échange.
//
// Le serveur ne garde qu'un ensemble d'enregistrements chiffrés, en ajout seul.
// Chaque version d'un enregistrement a sa propre clé : une séance terminée après
// coup, ou un réglage modifié, produit un nouvel enregistrement au lieu d'en
// remplacer un. Chaque appareil fusionne tout ce qu'il connaît de façon
// déterministe, si bien que tous arrivent au même état quel que soit l'ordre des
// envois.
import { isObject, validAttempt, validEvent, validSession } from '../backup';
import type { Attempt, ProgressEvent, SessionRecord, Settings } from '../journal';

/** Version du format des enregistrements, à incrémenter s'il change de façon incompatible. */
export const SYNC_FORMAT = 1;

/**
 * Réglages partagés entre appareils. Le volume, le thème et le rappel quotidien
 * restent propres à chaque appareil (un téléphone en sombre, un ordinateur en clair).
 */
export const SYNCED_SETTINGS = [
  'noteNames',
  'octaveConvention',
  'instrument',
  'tempo',
  'autoAdvance',
  'activeTracks',
  'dailyGoalMinutes',
  'showLandmarks',
  'landmarks',
  'onboardingDone',
] as const satisfies readonly (keyof Settings)[];

export type SyncedSetting = (typeof SYNCED_SETTINGS)[number];

/** Modification d'un réglage : la plus récente l'emporte, champ par champ. */
export interface SettingChange {
  field: SyncedSetting;
  value: unknown;
  /** Horodatage de la modification sur l'appareil, en millisecondes. */
  at: number;
  /** Appareil d'origine : départage deux modifications au même instant. */
  device: string;
}

export type SyncRecord =
  | { kind: 'session'; value: SessionRecord }
  | { kind: 'attempt'; value: Attempt }
  | { kind: 'event'; value: ProgressEvent }
  | { kind: 'setting'; value: SettingChange };

/**
 * Clé d'une version d'enregistrement. Les réponses et les événements ne changent
 * jamais ; une séance a deux versions (en cours, puis terminée) ; chaque
 * modification de réglage est un enregistrement à part.
 */
export function recordKey(record: SyncRecord): string {
  switch (record.kind) {
    case 'session':
      return `session:${record.value.id}:${record.value.endedAt ?? 'open'}`;
    case 'attempt':
      return `attempt:${record.value.id}`;
    case 'event':
      return `event:${record.value.id}`;
    case 'setting':
      return `setting:${record.value.field}:${record.value.at}:${record.value.device}`;
  }
}

/** Contenu d'un enregistrement avant chiffrement. */
export interface SyncEnvelope {
  v: number;
  record: SyncRecord;
}

export function envelope(record: SyncRecord): SyncEnvelope {
  return { v: SYNC_FORMAT, record };
}

export type ParsedEnvelope =
  | { ok: true; record: SyncRecord }
  /** Enregistrement d'une version plus récente de l'appli : à relire après une mise à jour. */
  | { ok: false; reason: 'newer' }
  /** Enregistrement abîmé ou inconnu : ignoré. */
  | { ok: false; reason: 'invalid' };

const isSyncedSetting = (field: unknown): field is SyncedSetting =>
  (SYNCED_SETTINGS as readonly unknown[]).includes(field);

/**
 * Vérifie un enregistrement reçu. Un enregistrement d'un format plus récent n'est
 * pas perdu : l'appareil le garde de côté pour le relire une fois l'appli à jour.
 */
export function parseEnvelope(raw: unknown): ParsedEnvelope {
  if (!isObject(raw) || typeof raw.v !== 'number' || !isObject(raw.record)) {
    return { ok: false, reason: 'invalid' };
  }
  if (raw.v > SYNC_FORMAT) return { ok: false, reason: 'newer' };
  const { kind, value } = raw.record;
  if (!isObject(value)) return { ok: false, reason: 'invalid' };
  switch (kind) {
    case 'session':
      return validSession(value)
        ? { ok: true, record: { kind, value: value as unknown as SessionRecord } }
        : { ok: false, reason: 'invalid' };
    case 'attempt':
      return validAttempt(value)
        ? { ok: true, record: { kind, value: value as unknown as Attempt } }
        : { ok: false, reason: 'invalid' };
    case 'event':
      return validEvent(value)
        ? { ok: true, record: { kind, value: value as unknown as ProgressEvent } }
        : { ok: false, reason: 'invalid' };
    case 'setting':
      return isSyncedSetting(value.field) &&
        typeof value.at === 'number' &&
        Number.isFinite(value.at) &&
        typeof value.device === 'string' &&
        'value' in value
        ? { ok: true, record: { kind, value: value as unknown as SettingChange } }
        : { ok: false, reason: 'invalid' };
    default:
      // Type d'enregistrement ajouté par une version plus récente.
      return { ok: false, reason: 'newer' };
  }
}
