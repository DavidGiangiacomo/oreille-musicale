import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { CURRICULUM_VERSION, STEPS } from '../../core/curriculum';
import type { IntervalQuestion } from '../../core/exercise/intervalQuestion';
import { attemptFromEntry, type SessionRecord } from '../../core/journal';
import { projectSteps } from '../../core/progress/projection';
import { createRandom, type Random } from '../../core/random';
import { planDailySession, type DailyPlan } from '../../core/session/daily';
import { blockQuestion } from '../../core/session/review';
import { evaluateAnswer, type AnswerMetrics, type QuestionResult } from '../../core/session/series';
import { projectReviews } from '../../core/srs';
import type { IntervalCode } from '../../core/theory';
import { ProgressBar, SaveFailedAlert, ScreenHeader } from '../components/ScreenParts';
import { newId, newSeed } from '../ids';
import { useJournalWriter } from '../journalWriter';
import { useJournalData, type JournalData } from '../progress/useJournalData';
import { AudioGate } from '../question/AudioGate';
import { QuestionPlayer } from '../question/QuestionPlayer';
import { useSettings } from '../settings/settingsContext';
import { card, muted, primaryButton, secondaryButton } from '../styles';
import { DailySummary, type BlockOutcome } from './DailySummary';
import { blockDescription, blockTitle } from './labels';

/** Séance du jour (§8.7) : révisions dues et duels, puis l'étape du parcours. */
export function DailySessionScreen() {
  const data = useJournalData();
  if (!data) return null;
  return <DailyRun data={data} />;
}

function planFrom(data: JournalData, activeTracks: readonly string[], random: Random): DailyPlan {
  const at = Date.now();
  return planDailySession({
    reviews: projectReviews(data.events, data.attempts),
    attempts: data.attempts,
    steps: STEPS.filter((step) => activeTracks.includes(step.track)),
    stepStates: projectSteps(STEPS, data.events),
    at,
    random,
  });
}

interface Current {
  block: number;
  index: number;
  question: IntervalQuestion;
  result: QuestionResult | null;
}

function DailyRun({ data }: { data: JournalData }) {
  const { settings } = useSettings();
  const [random] = useState(() => createRandom(newSeed()));
  // Le plan est fixé à l'ouverture : les réponses de la séance ne le modifient pas.
  const [plan] = useState(() => planFrom(data, settings.activeTracks, random));
  const [session] = useState<SessionRecord>(() => ({
    id: newId(),
    kind: 'daily',
    startedAt: Date.now(),
    appVersion: __APP_VERSION__,
    curriculumVersion: CURRICULUM_VERSION,
  }));
  const writer = useJournalWriter(session);
  const [current, setCurrent] = useState<Current | null>(() => firstQuestion(plan, random));
  // Entre deux blocs : l'écran d'annonce du bloc suivant.
  const [intermission, setIntermission] = useState(false);
  const [outcomes, setOutcomes] = useState<BlockOutcome[]>([]);
  const [finished, setFinished] = useState(false);

  if (plan.blocks.length === 0) {
    return plan.step ? (
      <Navigate to={`/etape/${plan.step.id}`} replace />
    ) : (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <ScreenHeader backTo="/" backLabel="Accueil" title="Séance du jour" />
        <p>Rien à réviser aujourd'hui, et toutes les étapes sont validées.</p>
        <Link to="/" className={`${primaryButton} flex items-center justify-center`}>
          Retour à l'accueil
        </Link>
      </main>
    );
  }

  if (finished || !current) {
    return <DailySummary plan={plan} startedAt={session.startedAt} outcomes={outcomes} />;
  }

  const block = plan.blocks[current.block]!;
  const total = plan.blocks.reduce((sum, b) => sum + b.plan.length, 0);
  const done =
    plan.blocks.slice(0, current.block).reduce((sum, b) => sum + b.plan.length, 0) +
    current.index +
    (current.result ? 1 : 0);
  const isLastQuestion =
    current.block === plan.blocks.length - 1 && current.index === block.plan.length - 1;

  function answer(item: IntervalCode, metrics: AnswerMetrics) {
    if (!current || current.result) return;
    const result = evaluateAnswer(current.question, item, metrics);
    setCurrent({ ...current, result });
    setOutcomes((list) => {
      const next = [...list];
      const outcome = next[current.block] ?? { answered: 0, correct: 0 };
      next[current.block] = {
        answered: outcome.answered + 1,
        correct: outcome.correct + (result.correct ? 1 : 0),
      };
      return next;
    });
    writer.recordAttempt(
      attemptFromEntry(
        { question: current.question, result },
        {
          id: newId(),
          sessionId: session.id,
          at: Date.now(),
          instrument: settings.instrument,
          activity: block.kind === 'duel' ? 'duel' : 'review',
        },
      ),
    );
  }

  function next() {
    if (!current?.result) return;
    if (current.index + 1 < block.plan.length) {
      const item = block.plan[current.index + 1]!;
      setCurrent({
        block: current.block,
        index: current.index + 1,
        question: blockQuestion(block, item, random, current.question.midi[0]),
        result: null,
      });
      return;
    }
    if (current.block + 1 < plan.blocks.length) {
      const following = plan.blocks[current.block + 1]!;
      setCurrent({
        block: current.block + 1,
        index: 0,
        question: blockQuestion(following, following.plan[0]!, random, null),
        result: null,
      });
      setIntermission(true);
      return;
    }
    finish();
  }

  function finish() {
    writer.endSession();
    setFinished(true);
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <ScreenHeader
        backTo="/"
        backLabel="Accueil"
        title={blockTitle(block)}
        aside={`${done} / ${total}`}
        subtitle={
          plan.blocks.length > 1
            ? `Séance du jour · partie ${current.block + 1} sur ${plan.blocks.length}`
            : 'Séance du jour'
        }
      />
      <ProgressBar label="Progression de la séance" value={done} max={total} />
      {intermission ? (
        <section className={card}>
          <h2 className="text-lg font-semibold">Partie suivante : {blockTitle(block)}</h2>
          <p>{blockDescription(block)}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className={primaryButton} onClick={() => setIntermission(false)}>
              Continuer
            </button>
            <button type="button" className={secondaryButton} onClick={finish}>
              Terminer la séance
            </button>
          </div>
        </section>
      ) : (
        <>
          {current.block === 0 && current.index === 0 && !current.result && (
            <p className={muted}>{blockDescription(block)}</p>
          )}
          <AudioGate label="Commencer la séance">
            <QuestionPlayer
              question={current.question}
              result={current.result}
              onAnswer={answer}
              onNext={next}
              announcement={`Question ${done + 1} sur ${total} : écoute, puis choisis l’intervalle.`}
              allowAutoAdvance={!isLastQuestion && current.index + 1 < block.plan.length}
              compare={block.kind === 'duel' ? 'always' : 'errors'}
              nextLabel={
                isLastQuestion
                  ? 'Voir le bilan'
                  : current.index + 1 < block.plan.length
                    ? 'Question suivante'
                    : 'Partie suivante'
              }
            />
          </AudioGate>
        </>
      )}
      {writer.saveFailed && <SaveFailedAlert />}
    </main>
  );
}

function firstQuestion(plan: DailyPlan, random: Random): Current | null {
  const block = plan.blocks[0];
  if (!block) return null;
  return {
    block: 0,
    index: 0,
    question: blockQuestion(block, block.plan[0]!, random, null),
    result: null,
  };
}
