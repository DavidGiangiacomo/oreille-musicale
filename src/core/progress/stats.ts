// Statistiques (docs/DESIGN.md §8.6 et §9.1), toutes recalculées depuis le journal.
import type { StepDef, TrackDef } from '../curriculum';
import { FAMILIES, competenceId, parseCompetence } from '../exercise/families';
import type { Attempt } from '../journal';
import { contextOf, shiftDay, studyDay, type ReviewState } from '../srs';
import { DAY } from '../srs/time';
import { confusionMatrix } from './confusion';
import type { CompetenceState, MasteryLevel } from './projection';

// ——— Grille de maîtrise ———

export interface MasteryCell {
  competenceId: string;
  level: MasteryLevel;
  fragile: boolean;
}

export interface MasteryRow {
  /** Élément : « M3 », « maj », « maj.1 ». */
  item: string;
  /** Une case par présentation de la grille (null si l'élément n'y existe pas). */
  cells: (MasteryCell | null)[];
}

/**
 * Grille de maîtrise d'un parcours : une ligne par élément, dans l'ordre où le
 * parcours les introduit, une colonne par présentation.
 */
export function masteryGrid(
  track: TrackDef,
  steps: readonly StepDef[],
  competences: ReadonlyMap<string, CompetenceState>,
): MasteryRow[] {
  const items: string[] = [];
  for (const step of steps
    .filter((s) => s.track === track.id)
    .sort((a, b) => a.column - b.column)) {
    for (const item of step.newItems) if (!items.includes(item)) items.push(item);
  }
  return items.map((item) => ({
    item,
    cells: track.rows.map(({ presentation }) => {
      const id = competenceId(track.family, item, presentation);
      const state = competences.get(id);
      return state ? { competenceId: id, level: state.level, fragile: state.fragile } : null;
    }),
  }));
}

// ——— Confusions ———

export interface ConfusionTable {
  context: string;
  /** Réponses du contexte, dans l'ordre des boutons (lignes : jouée ; colonnes : répondue). */
  answers: string[];
  /** counts[jouée][répondue], sur 60 jours. */
  counts: number[][];
  /** Plus grand nombre d'erreurs d'une case. */
  maxErrors: number;
}

/** Une table par contexte de réponse où il y a eu des réponses, sur 60 jours. */
export function confusionTables(attempts: readonly Attempt[], at: number): ConfusionTable[] {
  const tables: ConfusionTable[] = [];
  for (const [context, rows] of confusionMatrix(attempts, at)) {
    const family = FAMILIES[context.split(':')[0] as keyof typeof FAMILIES];
    if (!family) continue;
    const seen = new Set<string>();
    for (const [played, row] of rows) {
      seen.add(played);
      for (const answered of row.keys()) seen.add(answered);
    }
    const answers = family.answerOrder.filter((answer) => seen.has(answer));
    const counts = answers.map((played) =>
      answers.map((answered) => rows.get(played)?.get(answered) ?? 0),
    );
    const maxErrors = Math.max(0, ...counts.flatMap((row, i) => row.filter((_, j) => j !== i)));
    tables.push({ context, answers, counts, maxErrors });
  }
  return tables;
}

export interface TopConfusion {
  context: string;
  /** Les deux réponses, dans l'ordre des boutons. */
  pair: [string, string];
  /** Erreurs entre les deux, dans un sens ou dans l'autre. */
  errors: number;
}

/** Les confusions les plus fréquentes, toutes familles confondues (« Tu confonds souvent… »). */
export function topConfusions(tables: readonly ConfusionTable[], count = 3): TopConfusion[] {
  const pairs: TopConfusion[] = [];
  for (const table of tables) {
    table.answers.forEach((a, i) => {
      table.answers.forEach((b, j) => {
        if (j <= i) return;
        const errors = (table.counts[i]?.[j] ?? 0) + (table.counts[j]?.[i] ?? 0);
        if (errors > 0) pairs.push({ context: table.context, pair: [a, b], errors });
      });
    });
  }
  return pairs.sort((x, y) => y.errors - x.errors).slice(0, count);
}

// ——— Progrès d'une compétence ———

export interface DailyPoint {
  /** Jour d'étude, « 2026-11-20 ». */
  day: string;
  answered: number;
  correct: number;
  /** Temps médian des bonnes réponses, ou null s'il n'y en a pas. */
  medianCorrectMs: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/** Réussite et temps de réponse d'une compétence, jour par jour (jours pratiqués seulement). */
export function competenceHistory(attempts: readonly Attempt[], id: string): DailyPoint[] {
  const days = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    if (attempt.competenceId !== id) continue;
    const day = studyDay(attempt.at);
    days.set(day, [...(days.get(day) ?? []), attempt]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, list]) => ({
      day,
      answered: list.length,
      correct: list.filter((a) => a.correct).length,
      medianCorrectMs: median(list.filter((a) => a.correct).map((a) => a.responseTimeMs)),
    }));
}

/** Compétences pratiquées, les plus travaillées d'abord. */
export function practicedCompetences(attempts: readonly Attempt[]): string[] {
  const counts = new Map<string, number>();
  for (const attempt of attempts) {
    if (!parseCompetence(attempt.competenceId)) continue;
    counts.set(attempt.competenceId, (counts.get(attempt.competenceId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([id]) => id);
}

// ——— Activité ———

export interface CalendarDay {
  day: string;
  activeMs: number;
}

/**
 * Calendrier des `weeks` dernières semaines, du lundi le plus ancien au jour
 * d'étude de `at`, une colonne par semaine.
 */
export function activityCalendar(
  activeMs: ReadonlyMap<string, number>,
  at: number,
  weeks = 12,
): CalendarDay[][] {
  const today = studyDay(at);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // lundi = 0
  const firstMonday = shiftDay(today, -weekday - 7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, i) => shiftDay(firstMonday, week * 7 + i))
      .filter((day) => day <= today)
      .map((day) => ({ day, activeMs: activeMs.get(day) ?? 0 })),
  );
}

// ——— Calibration des révisions ———

export interface ReviewCalibration {
  /** Révisions notées sur la période (hors entrées en révision). */
  count: number;
  /** Révisions réussies : toute note sauf « À revoir ». */
  passed: number;
}

/**
 * Réussite observée en révision sur les `days` derniers jours : FSRS vise 90 %, un
 * écart durable signale des paramètres à ajuster (§8.1).
 */
export function reviewCalibration(
  reviews: ReadonlyMap<string, ReviewState>,
  at: number,
  days = 30,
): ReviewCalibration {
  const since = at - days * DAY;
  let count = 0;
  let passed = 0;
  for (const state of reviews.values()) {
    for (const entry of state.history) {
      if (entry.source !== 'review' || entry.at < since || entry.at > at) continue;
      count += 1;
      if (entry.grade > 1) passed += 1;
    }
  }
  return { count, passed };
}

/** Contexte lisible d'une table : famille et présentation (« int:asc »). */
export const tableContext = contextOf;
