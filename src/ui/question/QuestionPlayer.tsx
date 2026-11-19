import { useEffect, useEffectEvent, useRef } from 'react';
import { intervalSoundFrom, type IntervalQuestion } from '../../core/exercise/intervalQuestion';
import type { NoteEvent } from '../../core/exercise/rendition';
import type { AnswerMetrics, QuestionResult } from '../../core/session/series';
import type { IntervalCode } from '../../core/theory';
import { audioEngine } from '../audio';
import { useSettings } from '../settings/settingsContext';
import { secondaryButton } from '../styles';
import { AnswerGrid } from './AnswerGrid';
import { FeedbackPanel } from './FeedbackPanel';
import { answerIndexForCode } from './keys';

/** Délai avant la question suivante après une bonne réponse (passage automatique). */
const AUTO_ADVANCE_DELAY_MS = 900;

export interface QuestionPlayerProps {
  question: IntervalQuestion;
  /** Résultat une fois la réponse donnée ; null tant qu'on attend la réponse. */
  result: QuestionResult | null;
  onAnswer: (item: IntervalCode, metrics: AnswerMetrics) => void;
  onNext: () => void;
  /** Annonce pour les lecteurs d'écran : « Question 3 sur 20 ». */
  announcement: string;
  /** Feedback bref (test de validation) ou complet. */
  brief?: boolean;
  /** Passage automatique après une bonne réponse (si le réglage l'autorise). */
  allowAutoAdvance?: boolean;
  nextLabel?: string;
}

/**
 * Une question : lecture automatique, réécoute, réponses, feedback. Mesure le
 * temps de réponse (depuis la fin de la première écoute) et compte les réécoutes.
 * Raccourcis : Espace réécoute, chiffres répondent, Entrée continue.
 * L'audio doit déjà être débloqué (voir AudioGate).
 */
export function QuestionPlayer({
  question,
  result,
  onAnswer,
  onNext,
  announcement,
  brief = false,
  allowAutoAdvance = true,
  nextLabel = 'Question suivante',
}: QuestionPlayerProps) {
  const { settings } = useSettings();
  const firstPlaybackEnd = useRef<number | null>(null);
  const replays = useRef(0);
  const replayButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const asking = result === null;
  const autoAdvancing = !asking && result.correct && settings.autoAdvance && allowAutoAdvance;
  const answerSound =
    result && !result.correct
      ? intervalSoundFrom(question.notes[0], result.answer, question.presentation, question.tempo)
      : null;

  function play(events: NoteEvent[]) {
    return audioEngine.play(events, { instrument: settings.instrument });
  }

  function replay() {
    play(question.events);
    if (asking) replays.current += 1;
  }

  function answer(item: IntervalCode) {
    if (!asking) return;
    const end = firstPlaybackEnd.current;
    onAnswer(item, {
      responseTimeMs: end === null ? 0 : performance.now() - end,
      replays: replays.current,
    });
  }

  // Lecture automatique de chaque nouvelle question.
  const playQuestion = useEffectEvent(() => {
    firstPlaybackEnd.current = play(question.events).notesEndAt;
    replays.current = 0;
    replayButton.current?.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (asking) playQuestion();
  }, [question, asking]);

  // Outil de test de bout en bout, absent de la version publiée.
  useEffect(() => {
    if (import.meta.env.DEV) {
      const debug = window as unknown as { __oreilleReponse?: string; __oreilleNumero?: number };
      debug.__oreilleReponse = question.item;
      debug.__oreilleNumero = (debug.__oreilleNumero ?? 0) + 1;
    }
  }, [question]);

  // Feedback : le bouton « suivant » prend le focus.
  useEffect(() => {
    if (!asking) nextButton.current?.focus({ preventScroll: true });
  }, [asking]);

  // Passage automatique après une bonne réponse.
  const advance = useEffectEvent(() => onNext());
  useEffect(() => {
    if (!autoAdvancing) return;
    const timer = window.setTimeout(advance, AUTO_ADVANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoAdvancing, question]);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space') {
      // Empêche aussi l'activation du bouton qui a le focus.
      event.preventDefault();
      if (!event.repeat) replay();
      return;
    }
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      if (!asking) {
        event.preventDefault();
        if (!event.repeat) onNext();
      }
      return;
    }
    if (!asking || event.repeat) return;
    const index = answerIndexForCode(event.code);
    const item = index === null ? undefined : question.choices[index];
    if (item) {
      event.preventDefault();
      answer(item);
    }
  });
  const onKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (event.code === 'Space') event.preventDefault();
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

  return (
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
        {asking ? announcement : ''}
      </p>
      <AnswerGrid
        choices={question.choices}
        correctItem={question.item}
        result={result}
        disabled={!asking}
        onAnswer={answer}
      />
      {result && (
        <FeedbackPanel
          question={question}
          result={result}
          answerSound={answerSound}
          settings={settings}
          brief={brief}
          autoAdvancing={autoAdvancing}
          nextLabel={nextLabel}
          nextButtonRef={nextButton}
          onPlayCorrect={() => play(question.events)}
          onPlayAnswer={() => answerSound && play(answerSound.events)}
          onNext={onNext}
        />
      )}
    </>
  );
}
