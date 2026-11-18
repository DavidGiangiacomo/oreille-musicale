import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { intervalSoundFrom } from '../../core/exercise/intervalQuestion';
import type { NoteEvent } from '../../core/exercise/rendition';
import { attemptFromEntry, sessionConfigOf } from '../../core/journal';
import { createRandom } from '../../core/random';
import {
  advance,
  answerCurrent,
  currentEntry,
  startSeries,
  type SeriesConfig,
} from '../../core/session/series';
import type { IntervalCode } from '../../core/theory';
import { audioEngine } from '../audio';
import { journal } from '../data';
import { presentationTitle } from '../format';
import { newId, newSeed } from '../ids';
import { useSettings } from '../settings/settingsContext';
import { card, muted, primaryButton, secondaryButton } from '../styles';
import { AnswerGrid } from './AnswerGrid';
import { FeedbackPanel } from './FeedbackPanel';
import { answerIndexForCode } from './keys';
import { configFromParams } from './seriesParams';
import { SeriesSummaryView } from './SeriesSummaryView';

/** Délai avant la question suivante après une bonne réponse (passage automatique). */
const AUTO_ADVANCE_DELAY_MS = 900;

export function SeriesScreen() {
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const [run, setRun] = useState(0);
  const config = configFromParams(params, settings.tempo);
  if (!config) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-bold">Série introuvable</h1>
        <p className={muted}>L'adresse de cette série n'est pas valide.</p>
        <Link to="/" className={`${primaryButton} flex items-center justify-center`}>
          Retour à l'accueil
        </Link>
      </main>
    );
  }
  return (
    <SeriesRun
      key={`${params.toString()}#${run}`}
      config={config}
      onRestart={() => setRun((count) => count + 1)}
    />
  );
}

function SeriesRun({ config, onRestart }: { config: SeriesConfig; onRestart: () => void }) {
  const { settings } = useSettings();
  const [random] = useState(() => createRandom(newSeed()));
  const [sessionId] = useState(newId);
  const [startedAt] = useState(() => Date.now());
  const [state, setState] = useState(() => startSeries(config, random));
  const [audioReady, setAudioReady] = useState(
    () => audioEngine.running && audioEngine.isLoaded(settings.instrument),
  );
  const [loading, setLoading] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const firstPlaybackEnd = useRef<number | null>(null);
  const replays = useRef(0);
  const persistence = useRef<Promise<void>>(Promise.resolve());
  const sessionStarted = useRef(false);
  const replayButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);

  const entry = currentEntry(state);
  const { question, result } = entry;
  const answeredCount = state.entries.filter((e) => e.result !== null).length;
  const isLast = state.entries.length >= state.config.length;
  const answerSound =
    result && !result.correct
      ? intervalSoundFrom(question.notes[0], result.answer, question.presentation, question.tempo)
      : null;

  function play(events: NoteEvent[]) {
    return audioEngine.play(events, { instrument: settings.instrument });
  }

  /** Enregistre dans l'ordre ; une erreur n'interrompt pas la série. */
  function persist(action: () => Promise<void>) {
    persistence.current = persistence.current.then(action).catch((error: unknown) => {
      console.error('Enregistrement impossible', error);
      setSaveFailed(true);
    });
  }

  function replay() {
    if (!audioReady) return;
    play(question.events);
    if (state.status === 'asking') replays.current += 1;
  }

  function answer(item: IntervalCode) {
    if (state.status !== 'asking' || !audioReady) return;
    const end = firstPlaybackEnd.current;
    const answered = answerCurrent(state, item, {
      responseTimeMs: end === null ? 0 : performance.now() - end,
      replays: replays.current,
    });
    setState(answered);
    const attempt = attemptFromEntry(currentEntry(answered), {
      id: newId(),
      sessionId,
      at: Date.now(),
      instrument: settings.instrument,
    });
    persist(async () => {
      if (!sessionStarted.current) {
        await journal.startSession({
          id: sessionId,
          kind: 'custom',
          startedAt,
          appVersion: __APP_VERSION__,
          curriculumVersion: '0',
          config: sessionConfigOf(config),
        });
        sessionStarted.current = true;
      }
      await journal.addAttempt(attempt);
    });
  }

  function next() {
    if (state.status !== 'feedback') return;
    const after = advance(state, random);
    setState(after);
    if (after.status === 'finished') persist(() => journal.endSession(sessionId, Date.now()));
  }

  async function startAudio() {
    setAudioError(null);
    try {
      await audioEngine.unlock();
      if (!audioEngine.isLoaded(settings.instrument)) {
        setLoading(0);
        await audioEngine.load(settings.instrument, setLoading);
      }
      setAudioReady(true);
    } catch {
      setAudioError('Le son n’a pas pu démarrer. Vérifie le volume et réessaie.');
    } finally {
      setLoading(null);
    }
  }

  // Lecture automatique de chaque nouvelle question.
  const playQuestion = useEffectEvent(() => {
    firstPlaybackEnd.current = play(question.events).notesEndAt;
    replays.current = 0;
    replayButton.current?.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (audioReady && state.status === 'asking') playQuestion();
  }, [audioReady, question, state.status]);

  // Feedback : le bouton « Question suivante » prend le focus.
  useEffect(() => {
    if (state.status === 'feedback') nextButton.current?.focus({ preventScroll: true });
  }, [state.status]);

  // Passage automatique après une bonne réponse (sauf à la dernière question).
  const autoAdvance = useEffectEvent(() => next());
  useEffect(() => {
    if (state.status !== 'feedback' || !result?.correct || !settings.autoAdvance || isLast) return;
    const timer = window.setTimeout(autoAdvance, AUTO_ADVANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.status, result, settings.autoAdvance, isLast]);

  // Raccourcis : Espace = réécouter, chiffres = répondre, Entrée = continuer.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!audioReady || state.status === 'finished') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space') {
      // Empêche aussi l'activation du bouton qui a le focus.
      event.preventDefault();
      if (!event.repeat) replay();
      return;
    }
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      if (state.status === 'feedback') {
        event.preventDefault();
        if (!event.repeat) next();
      }
      return;
    }
    if (state.status !== 'asking' || event.repeat) return;
    const index = answerIndexForCode(event.code);
    const item = index === null ? undefined : question.choices[index];
    if (item) {
      event.preventDefault();
      answer(item);
    }
  });
  const onKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (audioReady && event.code === 'Space') event.preventDefault();
  });
  useEffect(() => {
    const down = (event: KeyboardEvent) => onKeyDown(event);
    const up = (event: KeyboardEvent) => onKeyUp(event);
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, []);

  if (state.status === 'finished') {
    return <SeriesSummaryView state={state} onRestart={onRestart} />;
  }

  const position = state.entries.length;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="rounded-lg py-1 font-medium underline-offset-4 hover:underline">
            <span aria-hidden="true">← </span>Accueil
          </Link>
          <span className={`${muted} tabular-nums`}>
            Question {position} / {state.config.length}
          </span>
        </div>
        <h1 className="text-2xl font-bold">{presentationTitle(state.config.presentation)}</h1>
        <div
          role="progressbar"
          aria-label="Progression de la série"
          aria-valuemin={0}
          aria-valuemax={state.config.length}
          aria-valuenow={answeredCount}
          className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-amber-500 transition-[width]"
            style={{ width: `${(answeredCount / state.config.length) * 100}%` }}
          />
        </div>
      </header>

      {!audioReady ? (
        <section className={card}>
          <p>Active le son pour entendre les questions.</p>
          <button type="button" className={primaryButton} onClick={() => void startAudio()}>
            Commencer la série
          </button>
          {loading !== null && (
            <p role="status" className={muted}>
              Chargement du piano… {Math.round(loading * 100)} %
            </p>
          )}
          {audioError && (
            <p role="alert" className="text-red-700 dark:text-red-300">
              {audioError}
            </p>
          )}
        </section>
      ) : (
        <>
          <button
            ref={replayButton}
            type="button"
            onClick={replay}
            aria-keyshortcuts="Space"
            className={`${secondaryButton} min-h-14 text-lg`}
          >
            <span aria-hidden="true">↻ </span>Réécouter
            <kbd className="ml-2 font-sans text-xs opacity-60">Espace</kbd>
          </button>
          <p className="sr-only" aria-live="polite">
            {state.status === 'asking'
              ? `Question ${position} sur ${state.config.length} : écoute, puis choisis l’intervalle.`
              : ''}
          </p>
          <AnswerGrid
            choices={question.choices}
            correctItem={question.item}
            result={result}
            disabled={state.status !== 'asking'}
            onAnswer={answer}
          />
          {state.status === 'feedback' && result && (
            <FeedbackPanel
              entry={{ question, result }}
              answerSound={answerSound}
              settings={settings}
              isLast={isLast}
              nextButtonRef={nextButton}
              onPlayCorrect={() => play(question.events)}
              onPlayAnswer={() => answerSound && play(answerSound.events)}
              onNext={next}
            />
          )}
        </>
      )}

      {saveFailed && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          Tes réponses n'ont pas pu être enregistrées sur cet appareil.
        </p>
      )}
    </main>
  );
}
