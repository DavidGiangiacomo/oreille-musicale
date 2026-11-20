// Couleurs des statistiques : jetons CSS de index.css, validés pour les deux thèmes.

/** Case colorée par une intensité de 1 à 5 (0 : vide), avec son texte lisible dessus. */
export function heatStyle(step: number): { background: string; color: string } {
  return step <= 0
    ? { background: 'var(--chart-empty)', color: 'var(--chart-empty-ink)' }
    : { background: `var(--heat-${step})`, color: `var(--heat-ink-${step})` };
}

export function masteryStyle(level: number): { background: string; color: string } {
  return level <= 0
    ? { background: 'var(--chart-empty)', color: 'var(--chart-empty-ink)' }
    : { background: `var(--mastery-${level})`, color: `var(--mastery-ink-${level})` };
}

/** Intensité de 1 à 5 d'une valeur positive rapportée à un maximum. */
export function heatStep(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((value / max) * 5)));
}
