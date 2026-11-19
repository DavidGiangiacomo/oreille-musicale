import type { Ref } from 'react';
import type { Question } from '../../core/exercise/families';
import type { Sound } from '../../core/exercise/question';
import type { Settings } from '../../core/journal';
import type { QuestionResult } from '../../core/session/series';
import { characteristicNotes } from '../../core/exercise/scaleQuestion';
import {
  chordSymbol,
  formatNote,
  frenchIntervalLabel,
  midiOf,
  MODES,
  type ModeCode,
} from '../../core/theory';
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
  /** Mode de référence joué sur la même tonique (modes seulement). */
  reference: Comparison | null;
  settings: Settings;
  /** Verdict seul, sans mini-clavier ni écoute comparée (test de validation). */
  brief: boolean;
  /** La question suivante va arriver seule. */
  autoAdvancing: boolean;
  nextLabel: string;
  nextButtonRef: Ref<HTMLButtonElement>;
  onPlayCorrect: () => void;
  onPlayComparison: () => void;
  onPlayReference: () => void;
  onNext: () => void;
}

/**
 * Symboles de l'accord joué, français puis international : « Rém · Dm », et la
 * basse d'un accord renversé : « Do/Mi · C/E ».
 */
function chordSymbols(question: Question): string | null {
  if (question.family !== 'chd' && question.family !== 'inv') return null;
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
  reference,
  settings,
  brief,
  autoAdvancing,
  nextLabel,
  nextButtonRef,
  onPlayCorrect,
  onPlayComparison,
  onPlayReference,
  onNext,
}: FeedbackPanelProps) {
  const format = (note: string) =>
    formatNote(note, { naming: settings.noteNames, octave: settings.octaveConvention });
  const { family } = question;

  const isScale = question.family === 'scl' || question.family === 'mod';
  // Clavier : les notes de l'intervalle ou de l'accord, ou les degrés de la gamme.
  const shown = isScale ? question.degrees : question.notes;
  const shownMidi = shown.map(midiOf);
  // Note caractéristique d'un mode, mise en évidence avec son intervalle (« Si (6M) »).
  const characteristic = new Map<number, string>();
  if (question.family === 'mod') {
    const mode = MODES[question.code as ModeCode];
    characteristicNotes(question).forEach((note, i) => {
      characteristic.set(midiOf(note), frenchIntervalLabel(mode.characteristic[i] as string));
    });
  }
  const marks: KeyMark[] = shown.map((note, i) => {
    const midi = shownMidi[i] as number;
    const interval = characteristic.get(midi);
    return interval
      ? { midi, label: `${format(note)} (${interval})`, kind: 'characteristic' }
      : { midi, label: format(note), kind: 'played' };
  });
  const correct = answerLabel(family, question.answer).short;
  const compared = comparison ? answerLabel(family, comparison.answer).short : '';
  const comparedLabel = comparison?.isAnswer ? 'ta réponse' : compared;
  // Notes de la réponse comparée absentes de ce qui a été joué, une fois chacune.
  const comparedNotes = comparison
    ? comparison.sound.notes
        .map((note, i) => ({ note, midi: comparison.sound.midi[i] as number }))
        .filter(
          ({ midi }, i, all) =>
            !shownMidi.includes(midi) && all.findIndex((n) => n.midi === midi) === i,
        )
    : [];
  for (const { note, midi } of comparedNotes) {
    marks.push({ midi, label: `${format(note)} (${comparedLabel})`, kind: 'answer' });
  }
  const keyboardDescription =
    `Clavier : ${shown.map(format).join(', ')} ${isScale ? 'dans la gamme' : 'joués'}` +
    (characteristic.size > 0
      ? ` ; note caractéristique : ${[...characteristic.values()].join(', ')}`
      : '') +
    (comparedNotes.length > 0
      ? ` ; ${comparedNotes.map(({ note }) => format(note)).join(', ')} pour ${comparedLabel}`
      : '');
  // L'abréviation n'apporte rien quand le nom la contient (renversements, gammes, modes).
  const withShort = family === 'int' || family === 'chd';
  const showReference = !brief && reference !== null && reference.answer !== comparison?.answer;
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
              {withShort ? ` (${correct})` : ''}
            </p>
            <p>
              Ta réponse : {answerWithArticle(family, result.answer)}
              {withShort ? ` (${answerLabel(family, result.answer).short})` : ''}
            </p>
          </>
        )}
        {symbols && <p className="font-semibold">{symbols}</p>}
        {!brief && (
          <p className="text-lg">
            {isScale
              ? question.degrees.map(format).join(' ')
              : formatNotes(question.notes, question.presentation, settings)}
          </p>
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

      {showReference && (
        <button type="button" className={secondaryButton} onClick={onPlayReference}>
          <span aria-hidden="true">▶ </span>Comparer avec le mode de référence (
          {answerLabel(family, reference.answer).short.toLowerCase()})
        </button>
      )}

      {autoAdvancing && <p className={`text-sm ${muted}`}>Question suivante dans un instant…</p>}

      <button ref={nextButtonRef} type="button" className={primaryButton} onClick={onNext}>
        {nextLabel}
        <kbd className="ml-2 font-sans text-xs opacity-70">Entrée</kbd>
      </button>
    </section>
  );
}
