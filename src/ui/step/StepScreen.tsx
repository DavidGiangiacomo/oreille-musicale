import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CURRICULUM_VERSION, getStep, type StepDef, type StepPhase } from '../../core/curriculum';
import { intervalCompetenceId, parseIntervalCompetence } from '../../core/exercise/competence';
import type { IntervalQuestion } from '../../core/exercise/intervalQuestion';
import type { AskedItem } from '../../core/exercise/selection';
import {
  attemptFromEntry,
  type Attempt,
  type ProgressEvent,
  type SessionRecord,
} from '../../core/journal';
import { createRandom } from '../../core/random';
import { evaluateAnswer, type AnswerMetrics, type QuestionResult } from '../../core/session/series';
import {
  contrastComplete,
  createTestPlan,
  evaluateTest,
  nextStepQuestion,
  phaseAfter,
  phasesOf,
  type StepResult,
  type TestEvaluation,
} from '../../core/session/step';
import { INTERVALS, type IntervalCode } from '../../core/theory';
import { journal } from '../data';
import { newId, newSeed } from '../ids';
import { useJournalWriter } from '../journalWriter';
import { columnLabel, newItemsLabel, stepTitle } from '../progress/labels';
import { useConfusionBoost } from '../progress/useJournalData';
import { useProgress, type Progress } from '../progress/useProgress';
import { AudioGate } from '../question/AudioGate';
import { QuestionPlayer } from '../question/QuestionPlayer';
import { useSettings } from '../settings/settingsContext';
import { card, muted, primaryButton, secondaryButton } from '../styles';
import { ProgressBar, SaveFailedAlert, ScreenHeader } from '../components/ScreenParts';
import { DiscoveryPanel } from './DiscoveryPanel';
import { ContrastStatus, TrainingStatus } from './PhaseStatus';
import { PhaseTracker } from './PhaseTracker';
import { TestResultPanel } from './TestResultPanel';

type QuestionPhase = Exclude<StepPhase, 'discover'>;

/** Événement à enregistrer, sans ce que l'écran ajoute lui-même (identifiant, date, étape). */
type EventInput = ProgressEvent extends infer E
  ? E extends ProgressEvent
    ? Omit<E, 'id' | 'at' | 'stepId'>
    : never
  : never;

type Stage =
  | { kind: 'overview' }
  | { kind: 'discover' }
  | {
      kind: 'questions';
      phase: QuestionPhase;
      question: IntervalQuestion;
      result: QuestionResult | null;
      /** Réponses de la phase en cours (depuis son dernier début). */
      phaseResults: StepResult[];
      /** Plan du test, ou null. */
      plan: IntervalCode[] | null;
      notice: string | null;
    }
  | { kind: 'result'; evaluation: TestEvaluation };

export function StepScreen() {
  const { stepId = '' } = useParams();
  const step = getStep(stepId);
  const progress = useProgress();
  const boost = useConfusionBoost(step ? `int:${step.presentation}` : '');
  const data = useLiveQuery(
    () => (step ? journal.stepJournal(step.id) : Promise.resolve(null)),
    [stepId],
  );

  if (!step) return <Message title="Étape introuvable" text="Cette étape n'existe pas." />;
  // Tant que les données lues sont celles d'une autre étape (navigation d'une étape à
  // la suivante), on attend : l'étape doit démarrer avec son propre journal.
  if (!progress || !boost || !data || data.stepId !== step.id) {
    return <main className="mx-auto max-w-xl px-4 py-8">Chargement…</main>;
  }
  const state = progress.states.get(step.id);
  if (!state || state.status === 'locked') {
    return (
      <Message
        title="Étape verrouillée"
        text="Valide d'abord l'étape de gauche et celle du dessus dans le parcours."
      />
    );
  }
  return (
    <StepRun
      key={step.id}
      step={step}
      initial={data}
      validated={state.status === 'validated'}
      progress={progress}
      boost={boost}
    />
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className={muted}>{text}</p>
      <Link to="/parcours" className={`${primaryButton} flex items-center justify-center`}>
        Voir le parcours
      </Link>
    </main>
  );
}

function toAsked(attempt: Attempt): AskedItem<IntervalCode> | null {
  const parsed = parseIntervalCompetence(attempt.competenceId);
  return parsed ? { item: parsed.item, correct: attempt.correct } : null;
}

function lastPhase(events: readonly ProgressEvent[]): { phase: StepPhase; at: number } | null {
  const started = events.filter((event) => event.type === 'phase_started');
  const last = started.at(-1);
  return last && last.type === 'phase_started' ? { phase: last.phase, at: last.at } : null;
}

function StepRun({
  step,
  initial,
  validated,
  progress,
  boost,
}: {
  step: StepDef;
  initial: { events: ProgressEvent[]; attempts: Attempt[] };
  validated: boolean;
  progress: Progress;
  /** Renfort des paires confondues dans les tirages (§8.6). */
  boost: ReadonlyMap<IntervalCode, number>;
}) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [random] = useState(() => createRandom(newSeed()));
  const [session] = useState<SessionRecord>(() => ({
    id: newId(),
    kind: 'step',
    stepId: step.id,
    startedAt: Date.now(),
    appVersion: __APP_VERSION__,
    curriculumVersion: CURRICULUM_VERSION,
  }));
  const writer = useJournalWriter(session);
  const [history, setHistory] = useState<AskedItem<IntervalCode>[]>(() =>
    initial.attempts.map(toAsked).filter((asked) => asked !== null),
  );
  const [opened, setOpened] = useState(() => initial.events.length > 0);

  function questionStage(
    phase: QuestionPhase,
    phaseResults: StepResult[],
    plan: IntervalCode[] | null,
    previousFirstMidi: number | null,
    notice: string | null,
    knownHistory: readonly AskedItem<IntervalCode>[] = history,
  ): Stage {
    const question = nextStepQuestion({
      step,
      phase,
      history: knownHistory,
      phaseResults,
      random,
      previousFirstMidi,
      boost,
      ...(plan ? { plannedItem: plan[phaseResults.length] } : {}),
    });
    return { kind: 'questions', phase, question, result: null, phaseResults, plan, notice };
  }

  const [stage, setStage] = useState<Stage>(() => {
    if (validated) return { kind: 'overview' };
    const last = lastPhase(initial.events);
    if (!last || last.phase === 'discover') return { kind: 'discover' };
    if (last.phase === 'test') {
      // Un test interrompu recommence du début.
      return questionStage('test', [], createTestPlan(step, random), null, null);
    }
    const phaseResults = initial.attempts
      .filter((attempt) => attempt.activity === last.phase && attempt.at >= last.at)
      .map(toAsked)
      .filter((asked) => asked !== null)
      .map(({ item, correct }) => ({ item, correct: correct === true }));
    return questionStage(last.phase, phaseResults, null, null, 'Reprise là où tu t’étais arrêté.');
  });

  // La séance se termine quand on quitte l'étape.
  const { endSession } = writer;
  useEffect(() => endSession, [endSession]);

  function record(event: EventInput) {
    writer.recordEvent({ ...event, id: newId(), at: Date.now(), stepId: step.id } as ProgressEvent);
    setOpened(true);
  }

  function previousFirstMidi(): number | null {
    return stage.kind === 'questions' ? stage.question.midi[0] : null;
  }

  function startPhase(phase: StepPhase, notice: string | null = null) {
    record({ type: 'phase_started', phase });
    if (phase === 'discover') {
      setStage({ kind: 'discover' });
      return;
    }
    const plan = phase === 'test' ? createTestPlan(step, random) : null;
    setStage(questionStage(phase, [], plan, previousFirstMidi(), notice));
  }

  function answer(item: IntervalCode, metrics: AnswerMetrics) {
    if (stage.kind !== 'questions' || stage.result) return;
    const { question } = stage;
    const result = evaluateAnswer(question, item, metrics);
    setStage({
      ...stage,
      result,
      phaseResults: [...stage.phaseResults, { item: question.item, correct: result.correct }],
    });
    setHistory((current) => [...current, { item: question.item, correct: result.correct }]);
    writer.recordAttempt(
      attemptFromEntry(
        { question, result },
        {
          id: newId(),
          sessionId: session.id,
          at: Date.now(),
          instrument: settings.instrument,
          activity: stage.phase,
          stepId: step.id,
        },
      ),
    );
  }

  function finishTest(results: StepResult[]) {
    const evaluation = evaluateTest(step, results);
    if (evaluation.passed) {
      record({
        type: 'step_validated',
        score: evaluation.accuracy,
        competenceIds: step.newItems.map((item) => intervalCompetenceId(item, step.presentation)),
      });
    } else {
      record({ type: 'test_failed', score: evaluation.accuracy });
      // En cas d'échec, l'étape reprend à l'entraînement.
      record({ type: 'phase_started', phase: 'train' });
    }
    setStage({ kind: 'result', evaluation });
  }

  function next() {
    if (stage.kind !== 'questions' || !stage.result) return;
    const { phase, phaseResults, plan } = stage;
    if (phase === 'contrast' && contrastComplete(phaseResults)) {
      startPhase('train', 'Comparaison terminée : toutes les réponses sont maintenant proposées.');
      return;
    }
    if (phase === 'test' && plan && phaseResults.length >= plan.length) {
      finishTest(phaseResults);
      return;
    }
    setStage(questionStage(phase, phaseResults, plan, stage.question.midi[0], null));
  }

  function goToNextStep() {
    const nextStep = progress.current;
    void navigate(nextStep && nextStep.id !== step.id ? `/etape/${nextStep.id}` : '/parcours');
  }

  const currentPhase: StepPhase | null =
    stage.kind === 'discover' ? 'discover' : stage.kind === 'questions' ? stage.phase : null;
  const canSkipToTest =
    stage.kind === 'discover' || (stage.kind === 'questions' && stage.phase === 'contrast');

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <ScreenHeader
        backTo="/parcours"
        backLabel="Parcours"
        title={stepTitle(step)}
        subtitle={`${step.column === 1 ? 'Premiers repères' : 'Nouveau'} : ${newItemsLabel(step)} (${columnLabel(step).replace('+ ', '')})`}
      />
      <PhaseTracker phases={phasesOf(step)} current={currentPhase} />

      {stage.kind === 'overview' && (
        <section className={card}>
          <p className="text-lg font-semibold">
            <span aria-hidden="true">✓ </span>Étape validée.
          </p>
          <p className={muted}>Tu peux t'entraîner à nouveau ou repasser le test.</p>
          <AudioGate label="Activer le son">
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className={primaryButton} onClick={() => startPhase('train')}>
                S'entraîner
              </button>
              <button type="button" className={secondaryButton} onClick={() => startPhase('test')}>
                Repasser le test
              </button>
            </div>
          </AudioGate>
        </section>
      )}

      {stage.kind === 'discover' && (
        <AudioGate label="Activer le son et découvrir">
          <DiscoveryPanel
            step={step}
            random={random}
            nextPhase={phaseAfter(step, 'discover')}
            onListen={() => {
              if (!opened) record({ type: 'phase_started', phase: 'discover' });
            }}
            onContinue={() => startPhase(phaseAfter(step, 'discover'))}
          />
        </AudioGate>
      )}

      {stage.kind === 'questions' && (
        <AudioGate label="Activer le son et continuer">
          {stage.notice && (
            <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
              {stage.notice}
            </p>
          )}
          {stage.phase === 'contrast' && <ContrastStatus results={stage.phaseResults} />}
          {stage.phase === 'test' && stage.plan && (
            <>
              <p className={`${muted} tabular-nums`}>
                Test : question{' '}
                {Math.min(stage.phaseResults.length + (stage.result ? 0 : 1), stage.plan.length)} /{' '}
                {stage.plan.length} · il faut 90 % de bonnes réponses
              </p>
              <ProgressBar
                label="Progression du test"
                value={stage.phaseResults.length}
                max={stage.plan.length}
              />
            </>
          )}
          <QuestionPlayer
            question={stage.question}
            result={stage.result}
            onAnswer={answer}
            onNext={next}
            brief={stage.phase === 'test'}
            announcement={`${stage.phase === 'test' ? 'Test' : 'Question'} : écoute, puis choisis l’intervalle.`}
            nextLabel={
              stage.phase === 'test' && stage.plan && stage.phaseResults.length >= stage.plan.length
                ? 'Voir le résultat'
                : 'Question suivante'
            }
          />
          {stage.phase === 'train' && (
            <TrainingStatus
              step={step}
              results={stage.phaseResults}
              onTakeTest={() => startPhase('test')}
            />
          )}
        </AudioGate>
      )}

      {stage.kind === 'result' && (
        <TestResultPanel
          step={step}
          evaluation={stage.evaluation}
          nextLabel={
            progress.current && progress.current.id !== step.id
              ? 'Étape suivante'
              : 'Voir le parcours'
          }
          onNext={goToNextStep}
          onTrain={() => setStage(questionStage('train', [], null, null, null))}
          onRetest={() => startPhase('test')}
        />
      )}

      {canSkipToTest && (
        <button
          type="button"
          className={`${secondaryButton} text-sm`}
          onClick={() => startPhase('test')}
        >
          Je connais déjà : passer directement le test
        </button>
      )}

      <p className={`text-xs ${muted}`}>
        Réponses possibles : {step.answers.map((item) => INTERVALS[item].abbreviation).join(', ')}
      </p>
      {writer.saveFailed && <SaveFailedAlert />}
    </main>
  );
}
