// Hasard injectable et reproductible : à graine égale, mêmes tirages. Les tests et
// les rapports de bug peuvent ainsi rejouer exactement une série (docs/DESIGN.md §6.5).

export interface Random {
  /** Nombre dans [0, 1[. */
  next(): number;
}

/** Générateur mulberry32 : rapide, 32 bits d'état, suffisant pour des exercices. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Entier dans [min, max], bornes comprises. */
export function randomInt(random: Random, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error(`Intervalle d'entiers invalide : [${min}, ${max}]`);
  }
  return min + Math.floor(random.next() * (max - min + 1));
}

export function pick<T>(random: Random, items: readonly T[]): T {
  if (items.length === 0) throw new Error('Tirage dans une liste vide');
  return items[Math.floor(random.next() * items.length)] as T;
}

/** Tirage proportionnel aux poids (positifs ou nuls, au moins un strictement positif). */
export function weightedPick<T>(
  random: Random,
  items: readonly T[],
  weights: readonly number[],
): T {
  if (items.length === 0 || items.length !== weights.length) {
    throw new Error('Tirage pondéré : listes vides ou de longueurs différentes');
  }
  const total = weights.reduce((sum, weight) => {
    if (!(weight >= 0)) throw new Error(`Poids invalide : ${weight}`);
    return sum + weight;
  }, 0);
  if (total <= 0) throw new Error('Tirage pondéré : tous les poids sont nuls');
  let threshold = random.next() * total;
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i] as number;
    if (threshold < 0) return items[i] as T;
  }
  // Arrondi flottant : on retombe sur le dernier élément de poids non nul.
  for (let i = items.length - 1; i >= 0; i--) if ((weights[i] as number) > 0) return items[i] as T;
  throw new Error('Tirage pondéré impossible');
}
