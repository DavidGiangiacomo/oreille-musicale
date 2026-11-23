// Fusion déterministe de ce que deux appareils savent (docs/DESIGN.md §10.8).
import { normalizeSettings, type SessionRecord, type Settings } from '../journal';
import { SYNCED_SETTINGS, type SettingChange, type SyncedSetting } from './records';

/**
 * Version la plus complète d'une séance : la même séance peut arriver en cours
 * puis terminée. Renvoie la séance à enregistrer, ou null si rien ne change.
 */
export function mergeSession(
  local: SessionRecord | undefined,
  remote: SessionRecord,
): SessionRecord | null {
  if (!local) return remote;
  const endedAt =
    local.endedAt === undefined
      ? remote.endedAt
      : remote.endedAt === undefined
        ? local.endedAt
        : Math.max(local.endedAt, remote.endedAt);
  return endedAt === local.endedAt ? null : { ...local, endedAt };
}

/**
 * La modification `a` l'emporte-t-elle sur `b` ? La plus récente, puis l'appareil,
 * puis la valeur : un ordre total, pour que tous les appareils choisissent pareil.
 */
export function isNewer(a: SettingChange, b: SettingChange): boolean {
  if (a.at !== b.at) return a.at > b.at;
  if (a.device !== b.device) return a.device > b.device;
  return JSON.stringify(a.value) > JSON.stringify(b.value);
}

/** Dernière modification de chaque réglage, parmi toutes celles connues. */
export function latestChanges(
  changes: readonly SettingChange[],
): Map<SyncedSetting, SettingChange> {
  const latest = new Map<SyncedSetting, SettingChange>();
  for (const change of changes) {
    const current = latest.get(change.field);
    if (!current || isNewer(change, current)) latest.set(change.field, change);
  }
  return latest;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Copie indépendante d'une valeur de réglage (des données JSON). */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Réglages après application des dernières modifications connues. Une valeur que
 * cette version de l'appli ne comprend pas (un timbre ajouté depuis, par exemple)
 * est laissée de côté : le réglage garde sa valeur actuelle.
 */
export function resolveSettings(base: Settings, changes: readonly SettingChange[]): Settings {
  let settings = base;
  for (const [field, change] of latestChanges(changes)) {
    const candidate = normalizeSettings({ ...settings, [field]: change.value });
    if (same(candidate[field], change.value) && !same(settings[field], change.value)) {
      settings = candidate;
    }
  }
  return settings;
}

/** Modifications à enregistrer quand les réglages passent de `previous` à `next`. */
export function settingChanges(
  previous: Settings,
  next: Settings,
  at: number,
  device: string,
): SettingChange[] {
  return SYNCED_SETTINGS.filter((field) => !same(previous[field], next[field])).map((field) => ({
    field,
    value: copy(next[field]),
    at,
    device,
  }));
}

/** Tous les réglages partagés, pour l'appareil qui active la synchronisation. */
export function allSettingChanges(settings: Settings, at: number, device: string): SettingChange[] {
  return SYNCED_SETTINGS.map((field) => ({
    field,
    value: copy(settings[field]),
    at,
    device,
  }));
}
