// Jour d'étude (docs/DESIGN.md §8.1) : il commence à 4 h du matin, heure locale,
// pour qu'une séance tardive compte pour la veille.

export const DAY_START_HOUR = 4;
const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** Jour d'étude d'un instant, au format « AAAA-MM-JJ » (heure locale). */
export function studyDay(at: number): string {
  const date = new Date(at - DAY_START_HOUR * HOUR);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Jour d'étude décalé de `days` jours. */
export function shiftDay(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(year, month - 1, date + days));
  return shifted.toISOString().slice(0, 10);
}

/** Nombre de jours d'étude de `from` à `to` (positif si `to` est après). */
export function daysBetween(from: string, to: string): number {
  const toTime = (day: string) => {
    const [year, month, date] = day.split('-').map(Number) as [number, number, number];
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((toTime(to) - toTime(from)) / DAY);
}
