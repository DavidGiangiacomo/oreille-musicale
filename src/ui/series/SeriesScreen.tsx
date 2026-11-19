import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CURRICULUM_VERSION } from '../../core/curriculum';
import { attemptFromEntry, sessionConfigOf, type SessionRecord } from '../../core/journal';
import { createRandom } from '../../core/random';
import {
  advance,
  answerCurrent,
  currentEntry,
  startSeries,
  type AnswerMetrics,
  type SeriesConfig,
} from '../../core/session/series';
import type { IntervalCode } from '../../core/theory';
import { presentationTitle } from '../format';
import { newId, newSeed } from '../ids';
import { useJournalWriter } from '../journalWriter';
import { AudioGate } from '../question/AudioGate';
import { QuestionPlayer } from '../question/QuestionPlayer';
import { useSettings } from '../settings/settingsContext';
import { muted, primaryButton } from '../styles';
import { ProgressBar, SaveFailedAlert, ScreenHeader } from '../components/ScreenParts';
import { configFromParams } from './seriesParams';
import { SeriesSummaryView } from './SeriesSummaryView';

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
  const [session] = useState<SessionRecord>(() => ({
    id: newId(),
    kind: 'custom',
    startedAt: Date.now(),
    appVersion: __APP_VERSION__,
    curriculumVersion: CURRICULUM_VERSION,
    config: sessionConfigOf(config),
  }));
  const [state, setState] = useState(() => startSeries(config, random));
  const writer = useJournalWriter(session);

  const { question, result } = currentEntry(state);
  const isLast = state.entries.length >= state.config.length;
  const answeredCount = state.entries.filter((e) => e.result !== null).length;

  function answer(item: IntervalCode, metrics: AnswerMetrics) {
    if (state.status !== 'asking') return;
    const answered = answerCurrent(state, item, metrics);
    setState(answered);
    writer.recordAttempt(
      attemptFromEntry(currentEntry(answered), {
        id: newId(),
        sessionId: session.id,
        at: Date.now(),
        instrument: settings.instrument,
      }),
    );
  }

  function next() {
    if (state.status !== 'feedback') return;
    const after = advance(state, random);
    setState(after);
    if (after.status === 'finished') writer.endSession();
  }

  if (state.status === 'finished') {
    return <SeriesSummaryView state={state} onRestart={onRestart} />;
  }

  const position = state.entries.length;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <ScreenHeader
        backTo="/"
        backLabel="Accueil"
        title={presentationTitle(state.config.presentation)}
        aside={`Question ${position} / ${state.config.length}`}
      />
      <ProgressBar
        label="Progression de la série"
        value={answeredCount}
        max={state.config.length}
      />
      <AudioGate label="Commencer la série">
        <QuestionPlayer
          question={question}
          result={result}
          onAnswer={answer}
          onNext={next}
          announcement={`Question ${position} sur ${state.config.length} : écoute, puis choisis l’intervalle.`}
          allowAutoAdvance={!isLast}
          nextLabel={isLast ? 'Voir le bilan' : 'Question suivante'}
        />
      </AudioGate>
      {writer.saveFailed && <SaveFailedAlert />}
    </main>
  );
}
