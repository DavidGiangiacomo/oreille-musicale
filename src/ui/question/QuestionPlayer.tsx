import { useEffect, useEffectEvent, useRef } from 'react';
import { arpeggiatedEvents } from '../../core/exercise/chordQuestion';
import { FAMILIES, type Question } from '../../core/exercise/families';
import { MODES, type ModeCode } from '../../core/theory';
import { sequenceEvents } from '../../core/exercise/intervalQuestion';
import type { NoteEvent } from '../../core/exercise/rendition';
import type { AnswerMetrics, QuestionResult } from '../../core/session/series';
import { audioEngine } from '../audio';
import { useSettings } from '../settings/settingsContext';
import { muted, secondaryButton } from '../styles';
import { AnswerGrid } from './AnswerGrid';
import { FeedbackPanel, type Comparison } from './FeedbackPanel';
import { answerIndexForCode } from './keys';

/** Délai avant la question suivante après une bonne réponse (passage automatique). */
const AUTO_ADVANCE_DELAY_MS = 900;

export interface QuestionPlayerProps {
  question: Question;
  /** Résultat une fois la réponse donnée ; null tant qu'on attend la réponse. */
  result: QuestionResult | null;
  onAnswer: (answer: string, metrics: AnswerMetrics) => void;
  onNext: () => void;
  /** Annonce pour les lecteurs d'écran : « Question 3 sur 20 ». */
  announcement: string;
  /** Feedback bref (test de validation) ou complet. */
  brief?: boolean;
  /** Passage automatique après une bonne réponse (si le réglage l'autorise). */
  allowAutoAdvance?: boolean;
  nextLabel?: string;
  /**
   * Écoute comparée : après une erreur seulement (par défaut), ou après chaque
   * réponse avec l'autre réponse possible (duel) ; elle est alors jouée d'office.
   */
  compare?: 'errors' | 'always';
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
  compare = 'errors',
}: QuestionPlayerProps) {
  const { settings } = useSettings();
  const firstPlaybackEnd = useRef<number | null>(null);
  const replays = useRef(0);
  const replayButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const asking = result === null;
  const systematic = compare === 'always';
  const autoAdvancing =
    !asking && result.correct && settings.autoAdvance && allowAutoAdvance && !systematic;
  const comparedAnswer = !result
    ? null
    : !result.correct
      ? result.answer
      : systematic
        ? (question.choices.find((choice) => choice !== question.answer) ?? null)
        : null;
  const family = FAMILIES[question.family];
  const comparison: Comparison | null = comparedAnswer
    ? {
        answer: comparedAnswer,
        isAnswer: comparedAnswer === result?.answer,
        sound: family.soundFrom(question, family.itemFor(question, comparedAnswer)),
      }
    : null;
  // Mode : comparaison avec son mode de référence sur la même tonique (§6.3).
  const referenceMode =
    question.family === 'mod' ? MODES[question.answer as ModeCode].reference : null;
  const reference: Comparison | null =
    result && referenceMode
      ? {
          answer: referenceMode,
          isAnswer: referenceMode === result.answer,
          sound: family.soundFrom(question, referenceMode),
        }
      : null;
  // Aide « écouter arpégé » : pour un accord plaqué, comptée dans la note de révision.
  const canArpeggiate =
    (question.family === 'chd' || question.family === 'inv') && question.presentation !== 'arp';
  const helpUsed = useRef(false);

  function play(events: NoteEvent[]) {
    return audioEngine.play(events, { instrument: settings.instrument });
  }

  function replay() {
    play(question.events);
    if (asking) replays.current += 1;
  }

  function arpeggiate() {
    if (question.family !== 'chd' && question.family !== 'inv') return;
    play(arpeggiatedEvents(question));
    if (asking) helpUsed.current = true;
  }

  function answer(item: string) {
    if (!asking) return;
    const end = firstPlaybackEnd.current;
    onAnswer(item, {
      // Répondre avant la fin du son compte pour un temps nul.
      responseTimeMs: end === null ? 0 : Math.max(0, performance.now() - end),
      replays: replays.current,
      helpUsed: helpUsed.current,
    });
  }

  // Lecture automatique de chaque nouvelle question.
  const playQuestion = useEffectEvent(() => {
    firstPlaybackEnd.current = play(question.events).notesEndAt;
    replays.current = 0;
    helpUsed.current = false;
    replayButton.current?.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (asking) playQuestion();
  }, [question, asking]);

  // Outil de test de bout en bout, absent de la version publiée.
  useEffect(() => {
    if (import.meta.env.DEV) {
      const debug = window as unknown as { __oreilleReponse?: string; __oreilleNumero?: number };
      debug.__oreilleReponse = question.answer;
      debug.__oreilleNumero = (debug.__oreilleNumero ?? 0) + 1;
    }
  }, [question]);

  // Feedback : le bouton « suivant » prend le focus.
  useEffect(() => {
    if (!asking) nextButton.current?.focus({ preventScroll: true });
  }, [asking]);

  // Duel : la bonne réponse puis l'autre, jouées d'office après chaque réponse.
  const playComparison = useEffectEvent(() => {
    if (comparison) play(sequenceEvents([question, comparison.sound]));
  });
  useEffect(() => {
    if (!asking && systematic) playComparison();
  }, [asking, systematic]);

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
      <div className={canArpeggiate ? 'grid grid-cols-[3fr_2fr] gap-2' : 'flex flex-col'}>
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
        {canArpeggiate && (
          <button
            type="button"
            onClick={arpeggiate}
            className={`${secondaryButton} min-h-14 px-2 text-sm leading-tight`}
          >
            Écouter arpégé
            {asking && <span className={`block text-xs ${muted}`}>(aide)</span>}
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {asking ? announcement : ''}
      </p>
      <AnswerGrid
        family={question.family}
        choices={question.choices}
        correctAnswer={question.answer}
        result={result}
        disabled={!asking}
        onAnswer={answer}
      />
      {result && (
        <FeedbackPanel
          question={question}
          result={result}
          comparison={comparison}
          reference={reference}
          settings={settings}
          brief={brief}
          autoAdvancing={autoAdvancing}
          nextLabel={nextLabel}
          nextButtonRef={nextButton}
          onPlayCorrect={() => play(question.events)}
          onPlayComparison={() => comparison && play(comparison.sound.events)}
          onPlayReference={() => reference && play(reference.sound.events)}
          onNext={onNext}
        />
      )}
    </>
  );
}
