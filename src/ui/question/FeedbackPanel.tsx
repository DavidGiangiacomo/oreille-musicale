import type { Ref } from 'react';
import type { Question } from '../../core/exercise/families';
import type { Sound } from '../../core/exercise/question';
import type { Settings } from '../../core/journal';
import type { QuestionResult } from '../../core/session/series';
import { chordSymbol, formatNote } from '../../core/theory';
import { MiniKeyboard, type KeyMark } from '../components/MiniKeyboard';
import { formatNotes } from '../format';
import { answerLabel, answerWithArticle, itemDescription } from '../items';
import { muted, primaryButton, secondaryButton } from '../styles';

/** Réponse à comparer à la bonne, jouée depuis la même note de référence. */
export interface Comparison {
  answer: string;
  /** La réponse donnée (fausse), ou l'autre réponse d'un duel. */
  isAnswer: boolean;
  sound: Sound;
}

interface FeedbackPanelProps {
  question: Question;
  result: QuestionResult;
  comparison: Comparison | null;
  settings: Settings;
  /** Verdict seul, sans mini-clavier ni écoute comparée (test de validation). */
  brief: boolean;
  /** La question suivante va arriver seule. */
  autoAdvancing: boolean;
  nextLabel: string;
  nextButtonRef: Ref<HTMLButtonElement>;
  onPlayCorrect: () => void;
  onPlayComparison: () => void;
  onNext: () => void;
}

/**
 * Symboles de l'accord joué, français puis international : « Rém · Dm », et la
 * basse d'un accord renversé : « Do/Mi · C/E ».
 */
function chordSymbols(question: Question): string | null {
  if (question.family === 'int') return null;
  const symbol = (naming: 'fr' | 'en') => {
    const bass = question.notes[0];
    const slash =
      question.inversion > 0 && bass ? `/${formatNote(bass, { naming, octave: 'none' })}` : '';
    return chordSymbol(question.root, question.quality, naming) + slash;
  };
  const fr = symbol('fr');
  const en = symbol('en');
  return fr === en ? fr : `${fr} · ${en}`;
}

export function FeedbackPanel({
  question,
  result,
  comparison,
  settings,
  brief,
  autoAdvancing,
  nextLabel,
  nextButtonRef,
  onPlayCorrect,
  onPlayComparison,
  onNext,
}: FeedbackPanelProps) {
  const format = (note: string) =>
    formatNote(note, { naming: settings.noteNames, octave: settings.octaveConvention });
  const { family } = question;

  const marks: KeyMark[] = question.notes.map((note, i) => ({
    midi: question.midi[i] as number,
    label: format(note),
    kind: 'played',
  }));
  const correct = answerLabel(family, question.answer).short;
  const compared = comparison ? answerLabel(family, comparison.answer).short : '';
  const comparedLabel = comparison?.isAnswer ? 'ta réponse' : compared;
  // Notes de la réponse comparée absentes de ce qui a été joué.
  const comparedNotes = comparison
    ? comparison.sound.notes
        .map((note, i) => ({ note, midi: comparison.sound.midi[i] as number }))
        .filter(({ midi }) => !question.midi.includes(midi))
    : [];
  for (const { note, midi } of comparedNotes) {
    marks.push({ midi, label: `${format(note)} (${comparedLabel})`, kind: 'answer' });
  }
  const keyboardDescription =
    `Clavier : ${question.notes.map(format).join(', ')} joués` +
    (comparedNotes.length > 0
      ? ` ; ${comparedNotes.map(({ note }) => format(note)).join(', ')} pour ${comparedLabel}`
      : '');
  const symbols = chordSymbols(question);

  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${
        result.correct
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
          : 'border-red-500 bg-red-50 dark:bg-red-950/40'
      }`}
    >
      <div role="status" className="flex flex-col gap-1">
        {result.correct ? (
          <p className="text-xl font-bold">
            <span aria-hidden="true">✓ </span>Bonne réponse :{' '}
            {itemDescription(family, question.item, question.presentation).toLowerCase()}
          </p>
        ) : (
          <>
            <p className="text-xl font-bold">
              <span aria-hidden="true">✗ </span>Non : c'était{' '}
              {answerWithArticle(family, question.answer)}
              {family === 'inv' ? '' : ` (${correct})`}
            </p>
            <p>
              Ta réponse : {answerWithArticle(family, result.answer)}
              {family === 'inv' ? '' : ` (${answerLabel(family, result.answer).short})`}
            </p>
          </>
        )}
        {symbols && <p className="font-semibold">{symbols}</p>}
        {!brief && (
          <p className="text-lg">{formatNotes(question.notes, question.presentation, settings)}</p>
        )}
      </div>

      {!brief && <MiniKeyboard marks={marks} description={keyboardDescription} />}

      {!brief && comparison && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className={secondaryButton} onClick={onPlayCorrect}>
            <span aria-hidden="true">▶ </span>Écouter la bonne réponse ({correct})
          </button>
          <button type="button" className={secondaryButton} onClick={onPlayComparison}>
            <span aria-hidden="true">▶ </span>
            {comparison.isAnswer ? `Écouter ta réponse (${compared})` : `Écouter ${compared}`}
          </button>
        </div>
      )}

      {autoAdvancing && <p className={`text-sm ${muted}`}>Question suivante dans un instant…</p>}

      <button ref={nextButtonRef} type="button" className={primaryButton} onClick={onNext}>
        {nextLabel}
        <kbd className="ml-2 font-sans text-xs opacity-70">Entrée</kbd>
      </button>
    </section>
  );
}
