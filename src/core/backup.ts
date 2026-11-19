// Sauvegarde de la progression (docs/DESIGN.md §10.6) : un fichier JSON avec le
// journal et les réglages. L'importer remplace les données de l'appareil ; les
// projections (étapes, révisions, statistiques) se recalculent d'elles-mêmes.
import {
  normalizeSettings,
  type Attempt,
  type ProgressEvent,
  type SessionRecord,
  type Settings,
} from './journal';

export const BACKUP_FORMAT = 'oreille-musicale';
/** Version du format de fichier, à incrémenter s'il change de façon incompatible. */
export const BACKUP_VERSION = 1;

export interface BackupData {
  settings: Settings;
  sessions: SessionRecord[];
  attempts: Attempt[];
  events: ProgressEvent[];
}

export interface Backup extends BackupData {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** Version du schéma de la base à l'export. */
  schemaVersion: number;
  appVersion: string;
  curriculumVersion: string;
  /** Date de l'export, ISO 8601. */
  exportedAt: string;
}

export function createBackup(
  data: BackupData,
  meta: { schemaVersion: number; appVersion: string; curriculumVersion: string; at: number },
): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: meta.schemaVersion,
    appVersion: meta.appVersion,
    curriculumVersion: meta.curriculumVersion,
    exportedAt: new Date(meta.at).toISOString(),
    ...data,
  };
}

/** « oreille-musicale-2026-11-19.json », à la date locale de l'export. */
export function backupFileName(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${BACKUP_FORMAT}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

export interface BackupSummary {
  exportedAt: number;
  sessions: number;
  attempts: number;
  /** Première et dernière réponse, ou null s'il n'y en a pas. */
  firstAt: number | null;
  lastAt: number | null;
}

export type ParsedBackup =
  { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; error: string };

type Check = (value: Record<string, unknown>) => boolean;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const validSession: Check = (s) =>
  isString(s.id) &&
  ['daily', 'custom', 'step'].includes(s.kind as string) &&
  isNumber(s.startedAt) &&
  (s.endedAt === undefined || isNumber(s.endedAt));

const validAttempt: Check = (a) =>
  isString(a.id) &&
  isString(a.sessionId) &&
  isNumber(a.at) &&
  isString(a.activity) &&
  isString(a.competenceId) &&
  isObject(a.rendition) &&
  isObject(a.answer) &&
  typeof a.correct === 'boolean' &&
  isNumber(a.responseTimeMs) &&
  isNumber(a.replays) &&
  typeof a.helpUsed === 'boolean';

const validEvent: Check = (e) =>
  isString(e.id) &&
  isNumber(e.at) &&
  isString(e.stepId) &&
  ['phase_started', 'step_validated', 'test_failed'].includes(e.type as string);

function allValid(list: unknown, check: Check): list is Record<string, unknown>[] {
  return Array.isArray(list) && list.every((item) => isObject(item) && check(item));
}

/**
 * Lit et vérifie un fichier de sauvegarde. Le fichier entier est refusé au moindre
 * doute : mieux vaut ne rien importer qu'importer à moitié.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Ce fichier n’est pas une sauvegarde lisible (JSON invalide).' };
  }
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Ce fichier n’est pas une sauvegarde d’Oreille musicale.' };
  }
  if (!isNumber(raw.version) || raw.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: 'Cette sauvegarde vient d’une version plus récente de l’appli : mets-la à jour.',
    };
  }
  const exportedAt = Date.parse(String(raw.exportedAt));
  if (
    !allValid(raw.sessions, validSession) ||
    !allValid(raw.attempts, validAttempt) ||
    !allValid(raw.events, validEvent) ||
    !Number.isFinite(exportedAt)
  ) {
    return { ok: false, error: 'Cette sauvegarde est incomplète ou abîmée.' };
  }
  const attempts = raw.attempts as unknown as Attempt[];
  const times = attempts.map((attempt) => attempt.at);
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: raw.version,
    schemaVersion: isNumber(raw.schemaVersion) ? raw.schemaVersion : 0,
    appVersion: isString(raw.appVersion) ? raw.appVersion : '',
    curriculumVersion: isString(raw.curriculumVersion) ? raw.curriculumVersion : '',
    exportedAt: String(raw.exportedAt),
    settings: normalizeSettings(raw.settings),
    sessions: raw.sessions as unknown as SessionRecord[],
    attempts,
    events: raw.events as unknown as ProgressEvent[],
  };
  return {
    ok: true,
    backup,
    summary: {
      exportedAt,
      sessions: backup.sessions.length,
      attempts: attempts.length,
      firstAt: times.length > 0 ? Math.min(...times) : null,
      lastAt: times.length > 0 ? Math.max(...times) : null,
    },
  };
}
