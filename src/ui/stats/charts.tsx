// Briques des statistiques : tuiles, compteur, cases colorées, courbe. Couleurs tirées
// des jetons de index.css (validés pour les deux thèmes) ; le texte reste en couleurs
// de texte ; chaque valeur est aussi lisible sans survol (lecture et tableaux).
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { muted } from '../styles';

/** Tuile chiffrée : une valeur, son libellé, une précision facultative. */
export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <span className={`text-xs ${muted}`}>{label}</span>
      <span className="text-xl font-semibold">{value}</span>
      {hint && <span className={`text-xs ${muted}`}>{hint}</span>}
    </div>
  );
}

/** Ligne de lecture d'un graphique : ce que montre la case ou le point désigné. */
export function Readout({ children }: { children: ReactNode }) {
  return (
    <p aria-live="polite" className="min-h-6 text-sm">
      {children}
    </p>
  );
}

/** Tableau de valeurs replié sous un graphique (l'équivalent accessible). */
export function TableView({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium underline-offset-4 hover:underline">
        Voir les valeurs
      </summary>
      <table className="mt-2 w-full border-collapse text-left tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="border-b border-slate-200 py-1 pr-2 font-medium dark:border-slate-700"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border-b border-slate-100 py-1 pr-2 dark:border-slate-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export interface LinePoint {
  /** Libellé de l'axe horizontal (« 20 nov. »). */
  label: string;
  value: number;
}

/**
 * Courbe d'une seule série (pas de légende : le titre la nomme). Survol, toucher ou
 * flèches du clavier désignent un point, lu au-dessus du graphique.
 */
export function LineChart({
  title,
  points,
  max,
  format,
  ticks,
}: {
  title: string;
  points: LinePoint[];
  max: number;
  format: (value: number) => string;
  ticks: number[];
}) {
  const [index, setIndex] = useState(points.length - 1);
  const width = 320;
  const height = 120;
  const left = 36;
  const right = 10;
  const top = 8;
  const bottom = 20;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (i: number) =>
    left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (value: number) => top + plotH - (Math.min(value, max) / max) * plotH;
  const current = points[Math.min(index, points.length - 1)];
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');

  function pick(clientX: number, rect: DOMRect) {
    const ratio = (clientX - rect.left) / rect.width;
    const position = ((ratio * width - left) / plotW) * (points.length - 1);
    setIndex(Math.min(points.length - 1, Math.max(0, Math.round(position))));
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    else if (event.key === 'ArrowRight') setIndex((i) => Math.min(points.length - 1, i + 1));
    else return;
    event.preventDefault();
  }

  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <Readout>
        {current && (
          <>
            <strong className="tabular-nums">{format(current.value)}</strong>{' '}
            <span className={muted}>· {current.label}</span>
          </>
        )}
      </Readout>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none focus-visible:outline-2 focus-visible:outline-amber-500"
        role="img"
        aria-label={`${title} : ${points.map((p) => `${p.label}, ${format(p.value)}`).join(' ; ')}`}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerMove={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
        onPointerDown={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
            <text
              x={left - 6}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-slate-500 text-[10px] tabular-nums dark:fill-slate-400"
            >
              {format(tick)}
            </text>
          </g>
        ))}
        {points.length > 0 && (
          <>
            <text
              x={x(0)}
              y={height - 4}
              textAnchor="start"
              className="fill-slate-500 text-[10px] dark:fill-slate-400"
            >
              {points[0]?.label}
            </text>
            {points.length > 1 && (
              <text
                x={x(points.length - 1)}
                y={height - 4}
                textAnchor="end"
                className="fill-slate-500 text-[10px] dark:fill-slate-400"
              >
                {points.at(-1)?.label}
              </text>
            )}
          </>
        )}
        {current && (
          <line
            x1={x(index)}
            x2={x(index)}
            y1={top}
            y2={top + plotH}
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
        )}
        <path
          d={path}
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={i === index ? 5 : 4}
            fill="var(--chart-line)"
            className="stroke-white dark:stroke-slate-900"
            strokeWidth={2}
          />
        ))}
      </svg>
    </figure>
  );
}
