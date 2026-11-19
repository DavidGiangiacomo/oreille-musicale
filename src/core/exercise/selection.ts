import { weightedPick, type Random } from '../random';

/** Une question déjà posée : l'élément demandé et, si on a répondu, la réussite. */
export interface AskedItem<T> {
  item: T;
  correct: boolean | null;
}

export interface SelectionOptions<T = unknown> {
  /** Nombre maximal de fois la même réponse d'affilée (3 par défaut, §7.5). */
  maxRepeat?: number;
  /** Nombre de réponses récentes prises en compte pour le taux d'erreur (10 par défaut). */
  window?: number;
  /** Poids supplémentaire par élément, pour renforcer les paires confondues (§8.6). */
  boost?: ReadonlyMap<T, number>;
}

/**
 * Taux d'erreur récent, lissé vers 20 % : un élément peu entendu n'est ni
 * négligé ni sur-représenté.
 */
function smoothedErrorRate<T>(item: T, history: readonly AskedItem<T>[], window: number): number {
  let answered = 0;
  let errors = 0;
  for (let i = history.length - 1; i >= 0 && answered < window; i--) {
    const entry = history[i] as AskedItem<T>;
    if (entry.item !== item || entry.correct === null) continue;
    answered += 1;
    if (!entry.correct) errors += 1;
  }
  return (errors + 1) / (answered + 5);
}

/** Questions écoulées depuis le dernier passage de l'élément (depuis le début s'il n'est jamais venu). */
function questionsSince<T>(item: T, history: readonly AskedItem<T>[]): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if ((history[i] as AskedItem<T>).item === item) return history.length - 1 - i;
  }
  return history.length;
}

/**
 * Choisit l'élément de la prochaine question (§7.5) :
 * - poids = 1 + 2 × taux d'erreur récent + 1 s'il n'a pas été entendu depuis
 *   autant de questions qu'il y a d'éléments + renfort éventuel (paire confondue) ;
 * - jamais plus de `maxRepeat` fois la même réponse d'affilée ;
 * - un élément absent depuis 2 × (nombre d'éléments) questions est imposé, si
 *   bien qu'aucun ne reste plus de 3 × (nombre d'éléments) questions sans venir.
 */
export function selectNextItem<T>(
  items: readonly T[],
  history: readonly AskedItem<T>[],
  random: Random,
  options: SelectionOptions<T> = {},
): T {
  const { maxRepeat = 3, window = 10, boost } = options;
  if (items.length === 0) throw new Error('Aucun élément à proposer');
  if (items.length === 1) return items[0] as T;

  const count = items.length;
  const since = items.map((item) => questionsSince(item, history));

  const overdue = Math.max(...since);
  if (overdue >= 2 * count) {
    const candidates = items.filter((_, i) => since[i] === overdue);
    return weightedPick(
      random,
      candidates,
      candidates.map(() => 1),
    );
  }

  const recent = history.slice(-maxRepeat);
  const repeated =
    recent.length === maxRepeat && recent.every((entry) => entry.item === recent[0]?.item)
      ? recent[0]?.item
      : undefined;

  const weights = items.map((item, i) => {
    if (item === repeated) return 0;
    const staleness = (since[i] as number) >= count ? 1 : 0;
    const extra = boost?.get(item) ?? 0;
    return 1 + 2 * smoothedErrorRate(item, history, window) + staleness + extra;
  });
  return weightedPick(random, items, weights);
}

/**
 * Tirage qui met en avant certains éléments (les nouveaux d'une étape) : ils
 * reviennent dans une proportion `share` des questions environ, les autres se
 * partagent le reste selon `selectNextItem`. La limite des répétitions d'affilée
 * reste respectée.
 */
export function selectWithFocus<T>(
  items: readonly T[],
  focus: readonly T[],
  share: number,
  history: readonly AskedItem<T>[],
  random: Random,
  options: SelectionOptions<T> = {},
): T {
  const focused = items.filter((item) => focus.includes(item));
  const others = items.filter((item) => !focus.includes(item));
  if (focused.length === 0 || others.length === 0) {
    return selectNextItem(items, history, random, options);
  }
  const { maxRepeat = 3 } = options;
  const recent = history.slice(-maxRepeat);
  const blocked =
    focused.length === 1 &&
    recent.length === maxRepeat &&
    recent.every((entry) => entry.item === focused[0]);
  if (!blocked && random.next() < share) {
    return selectNextItem(focused, history, random, options);
  }
  return selectNextItem(others, history, random, options);
}
