/** Identifiant unique ; `randomUUID` n'existe qu'en contexte sécurisé (HTTPS, localhost). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Graine aléatoire pour une nouvelle série. */
export function newSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
  }
  return Math.floor(Math.random() * 2 ** 32);
}
