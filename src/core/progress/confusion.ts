// Matrice de confusion et duels (docs/DESIGN.md §8.6), recalculés depuis le journal.
import type { Attempt } from '../journal';
import { contextOf, isLapsed, type ReviewState } from '../srs';
import { FAMILIES, parseCompetence } from '../exercise/families';
import type { FamilyId } from '../exercise/question';
import { DAY } from '../srs/time';

export const CONFUSION = {
  /** Période observée. */
  windowDays: 60,
  /** Erreurs nécessaires pour une confusion active… */
  minErrors: 3,
  /** … représentant au moins 20 % des réponses à l'élément joué… */
  minShare: 0.2,
  /** … sur ses 20 dernières apparitions. */
  recentAppearances: 20,
} as const;

/** Un duel : deux réponses possibles, 10 questions, écoute comparée systématique. */
export const DUEL_LENGTH = 10;

/**
 * Réponse attendue pour une compétence : l'élément joué (intervalle, accord), ou le
 * renversement. La matrice compare réponses attendues et réponses données.
 */
function itemOf(competenceId: string): string {
  const parsed = parseCompetence(competenceId);
  if (!parsed) return competenceId.split(':')[1] ?? competenceId;
  return FAMILIES[parsed.family].answerOf(parsed.item);
}

const familyOfContext = (context: string) => FAMILIES[context.split(':')[0] as FamilyId];

/** Les duels ne concernent que les familles où l'on répond par l'élément joué. */
const duelable = (context: string) => {
  const family = familyOfContext(context);
  return family !== undefined && family.id !== 'inv';
};

/**
 * Réponses prises en compte : celles des 60 derniers jours, hors duels (avec deux
 * réponses seulement, ils exagéreraient la confusion qu'ils traitent).
 */
function observed(attempts: readonly Attempt[], at: number): Attempt[] {
  const since = at - CONFUSION.windowDays * DAY;
  return attempts
    .filter(
      (a) => a.activity !== 'duel' && a.at >= since && a.at <= at && a.answer.type === 'choice',
    )
    .sort((a, b) => a.at - b.at);
}

/** Contexte → élément joué → élément répondu → nombre de réponses (bonnes comprises). */
export type ConfusionMatrix = Map<string, Map<string, Map<string, number>>>;

export function confusionMatrix(attempts: readonly Attempt[], at: number): ConfusionMatrix {
  const matrix: ConfusionMatrix = new Map();
  for (const attempt of observed(attempts, at)) {
    const context = contextOf(attempt.competenceId);
    const played = itemOf(attempt.competenceId);
    const rows = matrix.get(context) ?? new Map<string, Map<string, number>>();
    const row = rows.get(played) ?? new Map<string, number>();
    row.set(attempt.answer.value, (row.get(attempt.answer.value) ?? 0) + 1);
    rows.set(played, row);
    matrix.set(context, rows);
  }
  return matrix;
}

export interface Confusion {
  context: string;
  played: string;
  answered: string;
  /** Erreurs sur 60 jours. */
  errors: number;
  /** Part de ces erreurs dans les 20 dernières apparitions de l'élément joué. */
  share: number;
  lastErrorAt: number;
}

/** Confusions actives, les plus fréquentes d'abord. */
export function activeConfusions(attempts: readonly Attempt[], at: number): Confusion[] {
  const byPlayed = new Map<string, Attempt[]>();
  for (const attempt of observed(attempts, at)) {
    const key = `${contextOf(attempt.competenceId)}|${itemOf(attempt.competenceId)}`;
    byPlayed.set(key, [...(byPlayed.get(key) ?? []), attempt]);
  }
  const confusions: Confusion[] = [];
  for (const [key, answers] of byPlayed) {
    const [context, played] = key.split('|') as [string, string];
    const recent = answers.slice(-CONFUSION.recentAppearances);
    const wrong = new Map<string, Attempt[]>();
    for (const attempt of answers) {
      if (attempt.correct) continue;
      wrong.set(attempt.answer.value, [...(wrong.get(attempt.answer.value) ?? []), attempt]);
    }
    for (const [answered, errors] of wrong) {
      const share = recent.filter((a) => a.answer.value === answered).length / recent.length;
      if (errors.length >= CONFUSION.minErrors && share >= CONFUSION.minShare) {
        confusions.push({
          context,
          played,
          answered,
          errors: errors.length,
          share,
          lastErrorAt: (errors.at(-1) as Attempt).at,
        });
      }
    }
  }
  return confusions.sort(
    (a, b) => b.errors - a.errors || b.share - a.share || b.lastErrorAt - a.lastErrorAt,
  );
}

export interface Duel {
  context: string;
  /** Les deux réponses, dans l'ordre des boutons. */
  pair: [string, string];
  reason: 'confusion' | 'lapse';
  /** Erreurs entre les deux sur 60 jours. */
  errors: number;
}

/** Les deux réponses dans l'ordre des boutons. */
function orderedPair(context: string, a: string, b: string): [string, string] {
  const order = familyOfContext(context)?.answerOrder ?? [];
  return order.indexOf(a) <= order.indexOf(b) ? [a, b] : [b, a];
}

const pairKey = (context: string, [a, b]: readonly [string, string]) => `${context}|${a}|${b}`;

/**
 * Fin du dernier duel mené jusqu'au bout sur chaque paire : 10 réponses de duel
 * dans une même séance, avec ces deux réponses proposées.
 */
function completedDuels(attempts: readonly Attempt[]): Map<string, number> {
  const progress = new Map<string, { count: number; last: number }>();
  for (const attempt of attempts) {
    if (attempt.activity !== 'duel' || attempt.choices?.length !== 2) continue;
    const context = contextOf(attempt.competenceId);
    const pair = orderedPair(context, attempt.choices[0] as string, attempt.choices[1] as string);
    const key = `${attempt.sessionId}#${pairKey(context, pair)}`;
    const current = progress.get(key) ?? { count: 0, last: 0 };
    progress.set(key, { count: current.count + 1, last: Math.max(current.last, attempt.at) });
  }
  const done = new Map<string, number>();
  for (const [key, { count, last }] of progress) {
    if (count < DUEL_LENGTH) continue;
    const pair = key.slice(key.indexOf('#') + 1);
    done.set(pair, Math.max(done.get(pair) ?? 0, last));
  }
  return done;
}

/** Partenaire d'un duel ciblé : l'élément le plus souvent répondu à sa place, sinon le plus proche. */
function lapsePartner(
  context: string,
  item: string,
  matrix: ConfusionMatrix,
  candidates: readonly string[],
): string | null {
  const row = matrix.get(context)?.get(item);
  const confused = [...(row ?? [])]
    .filter(([answered]) => answered !== item)
    .sort((a, b) => b[1] - a[1])[0];
  if (confused) return confused[0];
  const family = familyOfContext(context);
  if (!family) return null;
  const others = candidates.filter((candidate) => candidate !== item);
  others.sort(
    (a, b) =>
      family.distance(a, item) - family.distance(b, item) ||
      family.answerOrder.indexOf(a) - family.answerOrder.indexOf(b),
  );
  return others[0] ?? null;
}

/**
 * Duels à proposer dans la prochaine séance du jour :
 * - pour chaque confusion active, sauf si un duel l'a traitée depuis la dernière erreur
 *   entre les deux éléments ;
 * - pour chaque compétence oubliée à sa dernière révision (duel ciblé, §8.4), sauf si
 *   un duel l'a traitée depuis.
 * Les plus fréquentes d'abord, sans doublon.
 */
export function pendingDuels(
  attempts: readonly Attempt[],
  reviews: ReadonlyMap<string, ReviewState>,
  at: number,
): Duel[] {
  const done = completedDuels(attempts);
  const matrix = confusionMatrix(attempts, at);
  const errorsBetween = (context: string, [a, b]: [string, string]) =>
    (matrix.get(context)?.get(a)?.get(b) ?? 0) + (matrix.get(context)?.get(b)?.get(a) ?? 0);
  const duels = new Map<string, Duel>();

  // Dernière erreur entre les deux éléments d'une paire, dans un sens ou dans l'autre.
  const lastError = new Map<string, number>();
  for (const attempt of observed(attempts, at)) {
    if (attempt.correct) continue;
    const context = contextOf(attempt.competenceId);
    const pair = orderedPair(context, itemOf(attempt.competenceId), attempt.answer.value);
    lastError.set(pairKey(context, pair), attempt.at);
  }

  for (const confusion of activeConfusions(attempts, at)) {
    if (!duelable(confusion.context)) continue;
    const pair = orderedPair(confusion.context, confusion.played, confusion.answered);
    const key = pairKey(confusion.context, pair);
    if ((done.get(key) ?? 0) > (lastError.get(key) ?? 0) || duels.has(key)) continue;
    duels.set(key, {
      context: confusion.context,
      pair,
      reason: 'confusion',
      errors: errorsBetween(confusion.context, pair),
    });
  }

  const acquired = new Map<string, string[]>();
  for (const id of reviews.keys()) {
    const context = contextOf(id);
    acquired.set(context, [...(acquired.get(context) ?? []), itemOf(id)]);
  }
  for (const state of reviews.values()) {
    if (!isLapsed(state)) continue;
    const context = contextOf(state.competenceId);
    if (!duelable(context)) continue;
    const item = itemOf(state.competenceId);
    const treated = [...done].some(([key, time]) => {
      const [doneContext, a, b] = key.split('|');
      return doneContext === context && (a === item || b === item) && time > state.lastReviewAt;
    });
    if (treated) continue;
    const partner = lapsePartner(context, item, matrix, acquired.get(context) ?? []);
    if (!partner) continue;
    const pair = orderedPair(context, item, partner);
    const key = pairKey(context, pair);
    if (!duels.has(key)) {
      duels.set(key, { context, pair, reason: 'lapse', errors: errorsBetween(context, pair) });
    }
  }
  return [...duels.values()].sort((a, b) => b.errors - a.errors);
}

/**
 * Renfort des paires confondues dans les tirages (§8.6) : poids supplémentaire
 * par élément d'un contexte, 1 par confusion active où il figure.
 */
export function confusionBoost(
  confusions: readonly Confusion[],
  context: string,
): Map<string, number> {
  const boost = new Map<string, number>();
  for (const confusion of confusions) {
    if (confusion.context !== context) continue;
    for (const item of [confusion.played, confusion.answered]) {
      boost.set(item, (boost.get(item) ?? 0) + 1);
    }
  }
  return boost;
}
