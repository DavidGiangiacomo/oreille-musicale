export interface KeyMark {
  midi: number;
  /** Nom affiché sous la touche (« Ré3 »). */
  label: string;
  /** Note jouée, note caractéristique d'un mode, ou note de la réponse comparée. */
  kind: 'played' | 'characteristic' | 'answer';
}

const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
const WHITE_WIDTH = 24;
const WHITE_HEIGHT = 96;
const BLACK_WIDTH = 14;
const BLACK_HEIGHT = 58;
const LABEL_ROW = 20;
/** Largeur moyenne d'un caractère des étiquettes, en unités du dessin. */
const CHAR_WIDTH = 6.6;

function isWhite(midi: number): boolean {
  return WHITE_PITCH_CLASSES.includes(((midi % 12) + 12) % 12);
}

const FILL = {
  white: 'fill-white dark:fill-slate-100',
  black: 'fill-slate-900 dark:fill-slate-950',
  played: 'fill-amber-400',
  characteristic: 'fill-violet-400',
  answer: 'fill-sky-300',
};

const LABEL_FILL = {
  played: 'fill-amber-800 dark:fill-amber-300',
  characteristic: 'fill-violet-700 dark:fill-violet-300',
  answer: 'fill-sky-700 dark:fill-sky-300',
};

/**
 * Clavier de piano en SVG, du do inférieur au si supérieur aux notes marquées.
 * Les notes jouées sont pleines, la réponse donnée en pointillés ; chaque marque
 * est nommée sous le clavier, pour ne jamais reposer sur la couleur seule.
 */
export function MiniKeyboard({ marks, description }: { marks: KeyMark[]; description: string }) {
  if (marks.length === 0) return null;
  const midis = marks.map((mark) => mark.midi);
  const pitchClass = (midi: number) => ((midi % 12) + 12) % 12;
  let start = Math.min(...midis) - pitchClass(Math.min(...midis));
  let end = Math.max(...midis) - pitchClass(Math.max(...midis)) + 11;
  // Au moins deux octaves, pour garder des touches et un texte de taille normale ;
  // l'octave ajoutée est placée de façon à centrer les notes marquées.
  if (end - start + 1 < 24) {
    const average = midis.reduce((sum, midi) => sum + (midi - start), 0) / midis.length;
    if (average >= 6) end += 12;
    else start -= 12;
  }

  const whiteX = new Map<number, number>();
  for (let midi = start; midi <= end; midi++) {
    if (isWhite(midi)) whiteX.set(midi, whiteX.size * WHITE_WIDTH);
  }
  const centerOf = (midi: number) =>
    isWhite(midi)
      ? (whiteX.get(midi) ?? 0) + WHITE_WIDTH / 2
      : (whiteX.get(midi - 1) ?? 0) + WHITE_WIDTH;
  const markOf = (midi: number) => marks.find((mark) => mark.midi === midi);

  const width = whiteX.size * WHITE_WIDTH;

  // Étiquettes : chacune va sur la première rangée où elle ne chevauche pas la précédente.
  const rowEnds: number[] = [];
  const labels = [...marks]
    .sort((a, b) => centerOf(a.midi) - centerOf(b.midi))
    .map((mark) => {
      const half = (mark.label.length * CHAR_WIDTH) / 2;
      const x = Math.min(Math.max(centerOf(mark.midi), half), width - half);
      let row = rowEnds.findIndex((end) => x - half > end + 4);
      if (row === -1) row = rowEnds.push(0) - 1;
      rowEnds[row] = x + half;
      return { mark, row, x };
    });

  const height = WHITE_HEIGHT + rowEnds.length * LABEL_ROW + 6;

  const keyClass = (midi: number, white: boolean) => {
    const mark = markOf(midi);
    if (!mark) return white ? FILL.white : FILL.black;
    return FILL[mark.kind];
  };
  const dashed = (midi: number) => (markOf(midi)?.kind === 'answer' ? '4 3' : undefined);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={description}
      className="w-full max-w-md self-center"
    >
      {[...whiteX].map(([midi, x]) => (
        <rect
          key={midi}
          x={x + 0.5}
          y={0.5}
          width={WHITE_WIDTH - 1}
          height={WHITE_HEIGHT}
          rx={3}
          className={`${keyClass(midi, true)} stroke-slate-400`}
          strokeWidth={markOf(midi)?.kind === 'answer' ? 2 : 1}
          strokeDasharray={dashed(midi)}
        />
      ))}
      {Array.from({ length: end - start + 1 }, (_, i) => start + i)
        .filter((midi) => !isWhite(midi))
        .map((midi) => (
          <rect
            key={midi}
            x={centerOf(midi) - BLACK_WIDTH / 2}
            y={0.5}
            width={BLACK_WIDTH}
            height={BLACK_HEIGHT}
            rx={2}
            className={`${keyClass(midi, false)} stroke-slate-700`}
            strokeWidth={markOf(midi)?.kind === 'answer' ? 2 : 1}
            strokeDasharray={dashed(midi)}
          />
        ))}
      {labels.map(({ mark, row, x }) => (
        <text
          key={`${mark.kind}-${mark.midi}`}
          x={x}
          y={WHITE_HEIGHT + 15 + row * LABEL_ROW}
          textAnchor="middle"
          className={`text-[11px] font-semibold ${LABEL_FILL[mark.kind]}`}
        >
          {mark.label}
        </text>
      ))}
    </svg>
  );
}
