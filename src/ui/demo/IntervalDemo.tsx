import { useState } from 'react';
import type { InstrumentId } from '../../core/exercise/rendition';
import { INTERVALS, formatNote, midiOf } from '../../core/theory';
import { audioEngine } from '../audio';
import { describeInterval, randomInterval, type DemoInterval } from './randomInterval';

const INSTRUMENTS: { id: InstrumentId; label: string }[] = [
  { id: 'piano', label: 'Piano' },
  { id: 'pure', label: 'Son pur' },
];

export function IntervalDemo() {
  const [instrument, setInstrument] = useState<InstrumentId>('piano');
  const [current, setCurrent] = useState<DemoInterval | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function play(interval: DemoInterval) {
    setError(null);
    try {
      // Le premier clic sert de geste utilisateur pour débloquer l'audio.
      await audioEngine.unlock();
      if (!audioEngine.isLoaded(instrument)) {
        setProgress(0);
        await audioEngine.load(instrument, setProgress);
        setProgress(null);
      }
      setCurrent(interval);
      audioEngine.play(interval.events, { instrument });
    } catch (cause) {
      setProgress(null);
      setError(
        cause instanceof Error ? cause.message : 'La lecture audio a échoué sur cet appareil.',
      );
    }
  }

  function playNew() {
    void play(randomInterval(current ? midiOf(current.notes[0]) : null));
  }

  const loading = progress !== null;

  return (
    <section className="flex flex-col gap-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
          Timbre
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {INSTRUMENTS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={instrument === id}
              onClick={() => setInstrument(id)}
              className="min-h-12 rounded-xl border px-4 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 aria-pressed:border-amber-500 aria-pressed:bg-amber-50 aria-pressed:text-amber-900 dark:aria-pressed:bg-amber-950 dark:aria-pressed:text-amber-100 border-slate-300 dark:border-slate-700"
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={playNew}
          disabled={loading}
          className="min-h-14 rounded-xl bg-slate-900 px-6 text-lg font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
        >
          Jouer un intervalle
        </button>
        <button
          type="button"
          onClick={() => current && void play(current)}
          disabled={!current || loading}
          className="min-h-12 rounded-xl border border-slate-300 px-6 font-medium transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Réécouter
        </button>
      </div>

      {loading && (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Chargement du piano… {Math.round(progress * 100)} %
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
        >
          {error}
        </p>
      )}

      <div aria-live="polite" className="min-h-24">
        {current && (
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold">
              {describeInterval(current.code, current.presentation)}
            </p>
            <p className="text-lg text-slate-700 dark:text-slate-300">
              {current.notes
                .map((note) => formatNote(note))
                .join(current.presentation === 'harm' ? ' + ' : ' → ')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {INTERVALS[current.code].abbreviation} · {INTERVALS[current.code].semitones} demi-ton
              {INTERVALS[current.code].semitones > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
