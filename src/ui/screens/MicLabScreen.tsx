import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_VOICING,
  isVoiced,
  midiFromFrequency,
  nearestNote,
  noteNameOf,
  smoothPitches,
  type PitchEstimate,
  type VoicingThresholds,
} from '../../core/pitch/pitch';
import { formatNote } from '../../core/theory';
import { listenToPitch, MicrophoneUnavailable, type Listening } from '../../audio/microphone';
import { isNativeApp } from '../../platform/native';
import { copyText } from '../../platform/share';
import { ScreenHeader } from '../components/ScreenParts';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted, primaryButton, secondaryButton } from '../styles';

/** Durée du tracé affiché. */
const TRACE_MS = 8_000;

const ERRORS: Record<MicrophoneUnavailable['reason'], string> = {
  denied:
    'L’accès au micro a été refusé. Autorise-le dans les réglages du navigateur ou du téléphone.',
  missing: 'Aucun micro n’a été trouvé sur cet appareil.',
  unsupported: 'Ce navigateur ne permet pas d’utiliser le micro.',
  failed: 'Le micro n’a pas pu démarrer.',
};

interface Summary {
  frames: number;
  voiced: number;
  clarities: number[];
  noiseLevels: number[];
  pitches: number[];
  startedAt: number;
}

const emptySummary = (): Summary => ({
  frames: 0,
  voiced: 0,
  clarities: [],
  noiseLevels: [],
  pitches: [],
  startedAt: performance.now(),
});

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

const DECIMAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const PERCENT = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });

/** Tracé de la hauteur chantée sur les dernières secondes, demi-ton par demi-ton. */
function Trace({
  points,
  now,
  label,
}: {
  points: { time: number; midi: number | null }[];
  now: number;
  label: (midi: number) => string;
}) {
  const voiced = points.filter((point) => point.midi !== null).map((point) => point.midi!);
  const center = median(voiced) ?? 60;
  const low = Math.floor(center) - 7;
  const high = Math.floor(center) + 7;
  const width = 320;
  const height = 180;
  const x = (time: number) => width - ((now - time) / TRACE_MS) * width;
  const y = (midi: number) => height - ((midi - low) / (high - low)) * height;

  // Segments continus : une interruption de la voix coupe le tracé.
  const segments: string[] = [];
  let current: string[] = [];
  for (const point of points) {
    if (point.midi === null || point.midi < low || point.midi > high) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
    } else {
      current.push(`${x(point.time).toFixed(1)},${y(point.midi).toFixed(1)}`);
    }
  }
  if (current.length > 1) segments.push(current.join(' '));

  const lines = [];
  for (let midi = low; midi <= high; midi++) {
    const natural = ![1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
    lines.push(
      <g key={midi}>
        <line
          x1={0}
          x2={width}
          y1={y(midi)}
          y2={y(midi)}
          stroke="var(--chart-grid)"
          strokeWidth={natural ? 1 : 0.5}
          strokeDasharray={natural ? undefined : '2 3'}
        />
        {natural && (
          <text x={4} y={y(midi) - 2} fontSize={9} fill="currentColor" className={muted}>
            {label(midi)}
          </text>
        )}
      </g>,
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-lg bg-[var(--chart-empty)]"
      role="img"
      aria-label="Tracé de la hauteur chantée sur les huit dernières secondes"
    >
      {lines}
      {segments.map((segment, i) => (
        <polyline
          key={i}
          points={segment}
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/**
 * Labo micro (§11.1) : essai de la détection de la voix, avant de construire les
 * exercices chantés. On chante ; la note, l'écart en cents, la netteté et le niveau
 * s'affichent en direct, avec un bilan à recopier.
 */
export function MicLabScreen() {
  const { settings } = useSettings();
  const [listening, setListening] = useState<Listening | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<VoicingThresholds>(DEFAULT_VOICING);
  const [frame, setFrame] = useState(0);
  const [copied, setCopied] = useState<boolean | null>(null);
  const history = useRef<PitchEstimate[]>([]);
  const summary = useRef<Summary>(emptySummary());
  const thresholdsRef = useRef(thresholds);

  useEffect(() => {
    thresholdsRef.current = thresholds;
  }, [thresholds]);

  // Le micro se coupe en quittant l'écran ou quand l'appli passe en arrière-plan.
  useEffect(() => {
    if (!listening) return;
    const onHidden = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      listening.stop();
    };
  }, [listening]);

  // Affichage rafraîchi à chaque image, indépendamment du rythme des analyses.
  useEffect(() => {
    if (!listening) return;
    let id = requestAnimationFrame(function tick() {
      setFrame((n) => n + 1);
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [listening]);

  function onEstimate(estimate: PitchEstimate) {
    history.current.push(estimate);
    const cutoff = estimate.time - TRACE_MS;
    while (history.current.length > 0 && history.current[0]!.time < cutoff) history.current.shift();
    const stats = summary.current;
    stats.frames += 1;
    if (isVoiced(estimate, thresholdsRef.current)) {
      stats.voiced += 1;
      stats.clarities.push(estimate.clarity);
      stats.pitches.push(midiFromFrequency(estimate.frequency!));
    } else {
      stats.noiseLevels.push(estimate.levelDb);
    }
  }

  async function start() {
    setError(null);
    setCopied(null);
    history.current = [];
    summary.current = emptySummary();
    try {
      setListening(await listenToPitch(onEstimate));
    } catch (cause) {
      setError(cause instanceof MicrophoneUnavailable ? ERRORS[cause.reason] : ERRORS.failed);
    }
  }

  function stop() {
    setListening(null);
  }

  const name = (midi: number) =>
    formatNote(noteNameOf(midi), { naming: settings.noteNames, octave: settings.octaveConvention });

  const points = history.current;
  const smoothed = smoothPitches(
    points.map((point) =>
      isVoiced(point, thresholds) ? midiFromFrequency(point.frequency!) : null,
    ),
  );
  const trace = points.map((point, i) => ({ time: point.time, midi: smoothed[i] ?? null }));
  const latest = points.at(-1);
  const current = smoothed.at(-1) ?? null;
  const note = current === null ? null : nearestNote(current);
  const now = latest?.time ?? performance.now();

  const stats = summary.current;
  const seconds = (performance.now() - stats.startedAt) / 1000;
  const stable = smoothPitches(stats.pitches, 3).filter((p): p is number => p !== null);
  const report = [
    `Labo micro — ${isNativeApp() ? 'application Android' : 'navigateur'}, ${listening?.sampleRate ?? '?'} Hz`,
    `Durée : ${DECIMAL.format(seconds)} s`,
    `Voix détectée : ${stats.frames ? PERCENT.format(stats.voiced / stats.frames) : '—'} du temps`,
    `Netteté médiane : ${DECIMAL.format(median(stats.clarities) ?? 0)}`,
    `Bruit de fond : ${DECIMAL.format(median(stats.noiseLevels) ?? -100)} dB`,
    stable.length > 0
      ? `Notes chantées : de ${name(Math.round(Math.min(...stable)))} à ${name(Math.round(Math.max(...stable)))}`
      : 'Notes chantées : aucune',
    `Seuils : netteté ≥ ${DECIMAL.format(thresholds.minClarity)}, niveau ≥ ${thresholds.minLevelDb} dB`,
  ].join('\n');

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6" data-frame={frame}>
      <ScreenHeader backTo="/a-propos" backLabel="À propos" title="Labo micro" />

      <section className={card} aria-labelledby="labo-essai">
        <h2 id="labo-essai" className={cardTitle}>
          Essai de la détection de la voix
        </h2>
        <p className={muted}>
          Les exercices chantés viendront bientôt. Cet écran sert à vérifier que la voix est bien
          reconnue sur ton appareil : chante des notes tenues, graves et aiguës, au calme puis dans
          le bruit.
        </p>
        <p className="text-sm">
          Le micro n’est ouvert que pendant l’essai. Le son n’est ni enregistré ni envoyé : seule la
          hauteur détectée est affichée.
        </p>
        {listening ? (
          <button type="button" className={secondaryButton} onClick={stop}>
            Arrêter le micro
          </button>
        ) : (
          <button type="button" className={primaryButton} onClick={() => void start()}>
            Activer le micro
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </section>

      {listening && (
        <section className={card} aria-labelledby="labo-direct">
          <h2 id="labo-direct" className={cardTitle}>
            En direct
          </h2>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-5xl font-bold tabular-nums" aria-label="Note détectée">
              {note ? name(note.midi) : '—'}
            </p>
            <p className={`text-right text-sm tabular-nums ${muted}`}>
              {latest?.frequency && current !== null
                ? `${DECIMAL.format(latest.frequency)} Hz`
                : 'Chante une note tenue'}
              <br />
              Netteté {DECIMAL.format(latest?.clarity ?? 0)} · niveau{' '}
              {DECIMAL.format(latest?.levelDb ?? -100)} dB
            </p>
          </div>
          {/* Écart à la note la plus proche, de -50 à +50 cents. */}
          <div aria-label="Justesse" className="flex flex-col gap-1">
            <div className="relative h-3 rounded-full bg-[var(--chart-empty)]">
              <div className="absolute top-0 left-1/2 h-3 w-0.5 -translate-x-1/2 bg-slate-500" />
              {note && (
                <div
                  className="absolute top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--chart-line)]"
                  style={{ left: `${50 + note.cents}%` }}
                />
              )}
            </div>
            <p className={`text-center text-sm tabular-nums ${muted}`}>
              {note
                ? note.cents === 0
                  ? 'Juste'
                  : `${note.cents > 0 ? '+' : '−'}${Math.abs(note.cents)} cents (${note.cents > 0 ? 'un peu haut' : 'un peu bas'})`
                : 'Justesse : —'}
            </p>
          </div>
          <Trace points={trace} now={now} label={name} />
        </section>
      )}

      {stats.frames > 0 && (
        <section className={card} aria-labelledby="labo-bilan">
          <h2 id="labo-bilan" className={cardTitle}>
            Bilan
          </h2>
          <pre className="text-sm whitespace-pre-wrap">{report}</pre>
          <p className={`text-sm ${muted}`}>
            Recopie ce bilan dans l’issue des exercices chantés, avec ton appareil et le lieu (calme
            ou bruyant) : il servira à régler les seuils.
          </p>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => void copyText(report).then(setCopied)}
          >
            Copier le bilan
          </button>
          {copied !== null && (
            <p role="status" className="text-sm">
              {copied ? 'Bilan copié.' : 'La copie a été refusée.'}
            </p>
          )}
        </section>
      )}

      <section className={card} aria-labelledby="labo-seuils">
        <h2 id="labo-seuils" className={cardTitle}>
          Seuils
        </h2>
        <label className="flex flex-col gap-1">
          <span>Netteté minimale : {DECIMAL.format(thresholds.minClarity)}</span>
          <input
            type="range"
            min={0.5}
            max={0.99}
            step={0.01}
            value={thresholds.minClarity}
            onChange={(event) =>
              setThresholds({ ...thresholds, minClarity: Number(event.target.value) })
            }
            className="accent-amber-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Niveau minimal : {thresholds.minLevelDb} dB</span>
          <input
            type="range"
            min={-80}
            max={-20}
            step={1}
            value={thresholds.minLevelDb}
            onChange={(event) =>
              setThresholds({ ...thresholds, minLevelDb: Number(event.target.value) })
            }
            className="accent-amber-500"
          />
        </label>
      </section>
    </main>
  );
}
