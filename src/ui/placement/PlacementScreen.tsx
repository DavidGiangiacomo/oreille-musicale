import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  CURRICULUM_VERSION,
  STEPS,
  TRACKS,
  type TrackDef,
  type TrackId,
} from '../../core/curriculum';
import { competenceId, createQuestion, type Question } from '../../core/exercise/families';
import { attemptFromEntry, type ProgressEvent, type SessionRecord } from '../../core/journal';
import { projectSteps } from '../../core/progress/projection';
import { createRandom } from '../../core/random';
import {
  PLACEMENT,
  placementTiers,
  tierPassed,
  tierPlan,
  type PlacementTier,
} from '../../core/session/placement';
import { evaluateAnswer, type AnswerMetrics, type QuestionResult } from '../../core/session/series';
import { ProgressBar, SaveFailedAlert, ScreenHeader } from '../components/ScreenParts';
import { newId, newSeed } from '../ids';
import { useJournalWriter } from '../journalWriter';
import { stepTitle } from '../progress/labels';
import { useJournalData } from '../progress/useJournalData';
import { AudioGate } from '../question/AudioGate';
import { QuestionPlayer } from '../question/QuestionPlayer';
import { useSettings } from '../settings/settingsContext';
import { card, cardTitle, muted, primaryButton, secondaryButton } from '../styles';

/** Liste des tests de positionnement, un par parcours (§7.6). */
export function PlacementHub() {
  const data = useJournalData();
  const states = useMemo(() => (data ? projectSteps(STEPS, data.events) : null), [data]);
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <ScreenHeader
        backTo="/"
        backLabel="Accueil"
        title="Tests de positionnement"
        subtitle="Tu as déjà des bases ? Chaque test valide d’emblée les étapes que tu maîtrises, en 10 minutes au plus."
      />
      {states &&
        TRACKS.map((track) => {
          const tiers = placementTiers(
            track,
            STEPS,
            (id) => states.get(id)?.status === 'validated',
          );
          return (
            <section key={track.id} className={card} aria-labelledby={`test-${track.id}`}>
              <h2 id={`test-${track.id}`} className={cardTitle}>
                {track.name}
              </h2>
              {tiers.length > 0 ? (
                <Link
                  to={`/positionnement/${track.id}`}
                  className={`${secondaryButton} flex items-center justify-center`}
                >
                  Passer le test ({tiers.length} palier{tiers.length > 1 ? 's' : ''} au plus)
                </Link>
              ) : (
                <p className={muted}>{unavailableReason(track, states)}</p>
              )}
            </section>
          );
        })}
    </main>
  );
}

function unavailableReason(track: TrackDef, states: ReturnType<typeof projectSteps>): string {
  const own = STEPS.filter((step) => step.track === track.id);
  if (own.every((step) => states.get(step.id)?.status === 'validated')) {
    return 'Toutes les étapes sont déjà validées.';
  }
  const waiting = (track.unlockedBy ?? []).filter((id) => states.get(id)?.status !== 'validated');
  const step = waiting[0] ? STEPS.find((s) => s.id === waiting[0]) : undefined;
  return step
    ? `Disponible après ${stepTitle(step).replace(' · ', ', ')}.`
    : 'Rien à tester pour l’instant.';
}

type Stage =
  | { kind: 'intro' }
  | {
      kind: 'question';
      tier: number;
      index: number;
      question: Question;
      result: QuestionResult | null;
      correct: number;
    }
  | { kind: 'between'; tier: number }
  | { kind: 'done'; passedTiers: number };

/** Test de positionnement d'un parcours. */
export function PlacementScreen() {
  const { trackId = '' } = useParams();
  const track = TRACKS.find((candidate) => candidate.id === trackId);
  const data = useJournalData();
  if (!track) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <p>Ce parcours n’existe pas.</p>
        <Link to="/positionnement" className="underline">
          Retour aux tests
        </Link>
      </main>
    );
  }
  if (!data) return <main className="mx-auto max-w-xl px-4 py-8">Chargement…</main>;
  const states = projectSteps(STEPS, data.events);
  const tiers = placementTiers(track, STEPS, (id) => states.get(id)?.status === 'validated');
  return <PlacementRun key={track.id} track={track} tiers={tiers} />;
}

function PlacementRun({ track, tiers: initial }: { track: TrackDef; tiers: PlacementTier[] }) {
  const { settings } = useSettings();
  // Paliers figés au démarrage : valider un palier change la progression, pas le test en cours.
  const [tiers] = useState(initial);
  const [random] = useState(() => createRandom(newSeed()));
  const [plans] = useState(() => tiers.map((tier) => tierPlan(tier, random)));
  const [session] = useState<SessionRecord>(() => ({
    id: newId(),
    kind: 'placement',
    trackId: track.id as TrackId,
    startedAt: Date.now(),
    appVersion: __APP_VERSION__,
    curriculumVersion: CURRICULUM_VERSION,
  }));
  const writer = useJournalWriter(session);
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });

  function questionFor(tierIndex: number, index: number, previous: number | null): Question {
    const tier = tiers[tierIndex] as PlacementTier;
    return createQuestion(tier.step.family, {
      item: plans[tierIndex]?.[index] as string,
      presentation: tier.step.presentation,
      choices: tier.step.answers,
      range: tier.step.generation.range,
      tempo: tier.step.generation.tempo,
      previousAnchor: previous,
      random,
    });
  }

  function startTier(tierIndex: number, previous: number | null) {
    setStage({
      kind: 'question',
      tier: tierIndex,
      index: 0,
      question: questionFor(tierIndex, 0, previous),
      result: null,
      correct: 0,
    });
  }

  function answer(item: string, metrics: AnswerMetrics) {
    if (stage.kind !== 'question' || stage.result) return;
    const result = evaluateAnswer(stage.question, item, metrics);
    setStage({ ...stage, result, correct: stage.correct + (result.correct ? 1 : 0) });
    writer.recordAttempt(
      attemptFromEntry(
        { question: stage.question, result },
        {
          id: newId(),
          sessionId: session.id,
          at: Date.now(),
          instrument: settings.instrument,
          activity: 'placement',
          stepId: tiers[stage.tier]?.step.id,
        },
      ),
    );
  }

  /** Palier réussi : chaque étape couverte est validée et ses éléments entrent en révision. */
  function validateTier(tier: PlacementTier, score: number) {
    for (const step of tier.steps) {
      const event: ProgressEvent = {
        id: newId(),
        at: Date.now(),
        type: 'step_validated',
        stepId: step.id,
        score,
        competenceIds: step.newItems.map((item) =>
          competenceId(step.family, item, step.presentation),
        ),
      };
      writer.recordEvent(event);
    }
  }

  function next() {
    if (stage.kind !== 'question' || !stage.result) return;
    const plan = plans[stage.tier] ?? [];
    if (stage.index + 1 < plan.length) {
      setStage({
        ...stage,
        index: stage.index + 1,
        question: questionFor(stage.tier, stage.index + 1, stage.question.anchor),
        result: null,
      });
      return;
    }
    const tier = tiers[stage.tier] as PlacementTier;
    if (!tierPassed(stage.correct)) {
      writer.endSession();
      setStage({ kind: 'done', passedTiers: stage.tier });
      return;
    }
    validateTier(tier, stage.correct / PLACEMENT.questionsPerTier);
    if (stage.tier + 1 >= tiers.length) {
      writer.endSession();
      setStage({ kind: 'done', passedTiers: tiers.length });
      return;
    }
    setStage({ kind: 'between', tier: stage.tier + 1 });
  }

  const total = tiers.length;
  if (total === 0) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <ScreenHeader backTo="/positionnement" backLabel="Tests" title={`Test : ${track.name}`} />
        <p className={muted}>Rien à tester pour l’instant dans ce parcours.</p>
      </main>
    );
  }

  if (stage.kind === 'done') {
    const validated = tiers.slice(0, stage.passedTiers).flatMap((tier) => tier.steps);
    const nextStep = tiers[stage.passedTiers]?.steps[0];
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
        <ScreenHeader backTo="/positionnement" backLabel="Tests" title={`Test : ${track.name}`} />
        <section className={card} aria-labelledby="resultat-test">
          <h2 id="resultat-test" className="text-2xl font-bold">
            {validated.length > 0 ? (
              <>
                <span aria-hidden="true">✓ </span>
                {validated.length} étape{validated.length > 1 ? 's' : ''} validée
                {validated.length > 1 ? 's' : ''}
              </>
            ) : (
              'Commence par la première étape'
            )}
          </h2>
          <p>
            {stage.passedTiers === total
              ? 'Tous les paliers sont réussis.'
              : `Palier ${stage.passedTiers + 1} non réussi : il fallait ${PLACEMENT.passMin} bonnes réponses sur ${PLACEMENT.questionsPerTier}.`}
          </p>
          {validated.length > 0 && (
            <p className={muted}>
              Leurs éléments entrent dans tes révisions. Tu reprends le parcours
              {nextStep ? ` à : ${stepTitle(nextStep)}` : ' plus loin'}.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Link to="/parcours" className={`${primaryButton} flex items-center justify-center`}>
              Voir le parcours
            </Link>
            <Link
              to="/positionnement"
              className={`${secondaryButton} flex items-center justify-center`}
            >
              Autres tests
            </Link>
          </div>
        </section>
        {writer.saveFailed && <SaveFailedAlert />}
      </main>
    );
  }

  const tierIndex = stage.kind === 'intro' ? 0 : stage.tier;
  const tier = tiers[tierIndex] as PlacementTier;
  const done = stage.kind === 'question' ? stage.index + (stage.result ? 1 : 0) : 0;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <ScreenHeader
        backTo="/positionnement"
        backLabel="Tests"
        title={`Test : ${track.name}`}
        aside={`Palier ${tierIndex + 1} / ${total}`}
        subtitle={stepTitle(tier.step)}
      />
      <ProgressBar label="Progression du palier" value={done} max={PLACEMENT.questionsPerTier} />
      {stage.kind === 'intro' && (
        <section className={card}>
          <p>
            {total} palier{total > 1 ? 's' : ''} au plus, de {PLACEMENT.questionsPerTier} questions
            chacun. Le test s’arrête au premier palier où tu as moins de {PLACEMENT.passMin} bonnes
            réponses ; les étapes des paliers réussis sont validées.
          </p>
          <AudioGate label="Activer le son et commencer">
            <button type="button" className={primaryButton} onClick={() => startTier(0, null)}>
              Commencer le test
            </button>
          </AudioGate>
        </section>
      )}
      {stage.kind === 'between' && (
        <section className={card}>
          <p className="font-semibold">
            <span aria-hidden="true">✓ </span>Palier {stage.tier} réussi.
          </p>
          <p>Palier suivant : {stepTitle(tier.step)}.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={primaryButton}
              onClick={() => startTier(stage.tier, null)}
            >
              Continuer
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                writer.endSession();
                setStage({ kind: 'done', passedTiers: stage.tier });
              }}
            >
              Arrêter là
            </button>
          </div>
        </section>
      )}
      {stage.kind === 'question' && (
        <AudioGate label="Activer le son">
          <QuestionPlayer
            question={stage.question}
            result={stage.result}
            onAnswer={answer}
            onNext={next}
            brief
            announcement={`Question ${stage.index + 1} sur ${PLACEMENT.questionsPerTier} du palier ${tierIndex + 1}.`}
            nextLabel={
              stage.index + 1 < PLACEMENT.questionsPerTier ? 'Question suivante' : 'Fin du palier'
            }
            allowAutoAdvance={stage.index + 1 < PLACEMENT.questionsPerTier}
          />
        </AudioGate>
      )}
      {writer.saveFailed && <SaveFailedAlert />}
    </main>
  );
}
