import type { Ref } from 'react';
import type { Settings } from '../../core/journal';
import type { IntervalQuestion, IntervalSound } from '../../core/exercise/intervalQuestion';
import type { QuestionResult } from '../../core/session/series';
import { formatNote, INTERVALS, type IntervalCode } from '../../core/theory';
import { MiniKeyboard, type KeyMark } from '../components/MiniKeyboard';
import { describeInterval, formatNotes } from '../format';
import { muted, primaryButton, secondaryButton } from '../styles';

interface FeedbackPanelProps {
  question: IntervalQuestion;
  result: QuestionResult;
  /** Son de la réponse donnée, depuis la même première note (null si elle est juste). */
  answerSound: IntervalSound | null;
  settings: Settings;
  /** Verdict seul, sans mini-clavier ni écoute comparée (test de validation). */
  brief: boolean;
  /** La question suivante va arriver seule. */
  autoAdvancing: boolean;
  nextLabel: string;
  nextButtonRef: Ref<HTMLButtonElement>;
  onPlayCorrect: () => void;
  onPlayAnswer: () => void;
  onNext: () => void;
}

/** « une tierce majeure », « un triton ». */
function withArticle(code: IntervalCode): string {
  return `${code === 'TT' ? 'un' : 'une'} ${INTERVALS[code].name}`;
}

export function FeedbackPanel({
  question,
  result,
  answerSound,
  settings,
  brief,
  autoAdvancing,
  nextLabel,
  nextButtonRef,
  onPlayCorrect,
  onPlayAnswer,
  onNext,
}: FeedbackPanelProps) {
  const format = (note: string) =>
    formatNote(note, { naming: settings.noteNames, octave: settings.octaveConvention });

  const marks: KeyMark[] = question.notes.map((note, i) => ({
    midi: question.midi[i] as number,
    label: format(note),
    kind: 'played',
  }));
  if (answerSound) {
    marks.push({
      midi: answerSound.midi[1],
      label: `${format(answerSound.notes[1])} (ta réponse)`,
      kind: 'answer',
    });
  }
  const keyboardDescription =
    `Clavier : ${question.notes.map(format).join(' et ')} joués` +
    (answerSound ? ` ; ${format(answerSound.notes[1])} pour ta réponse` : '');

  const { abbreviation } = INTERVALS[question.item];

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
            {describeInterval(question.item, question.presentation).toLowerCase()}
          </p>
        ) : (
          <>
            <p className="text-xl font-bold">
              <span aria-hidden="true">✗ </span>Non : c'était {withArticle(question.item)} (
              {abbreviation})
            </p>
            <p>
              Ta réponse : {withArticle(result.answer)} ({INTERVALS[result.answer].abbreviation})
            </p>
          </>
        )}
        {!brief && (
          <p className="text-lg">{formatNotes(question.notes, question.presentation, settings)}</p>
        )}
      </div>

      {!brief && <MiniKeyboard marks={marks} description={keyboardDescription} />}

      {!brief && answerSound && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className={secondaryButton} onClick={onPlayCorrect}>
            <span aria-hidden="true">▶ </span>Écouter la bonne réponse ({abbreviation})
          </button>
          <button type="button" className={secondaryButton} onClick={onPlayAnswer}>
            <span aria-hidden="true">▶ </span>Écouter ta réponse (
            {INTERVALS[result.answer].abbreviation})
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
