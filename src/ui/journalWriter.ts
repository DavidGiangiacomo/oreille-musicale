import { useCallback, useRef, useState } from 'react';
import type { Attempt, ProgressEvent, SessionRecord } from '../core/journal';
import { journal } from './data';

/**
 * Écriture dans le journal, dans l'ordre et sans bloquer l'exercice. La séance
 * n'est créée qu'à la première réponse : ouvrir un écran sans répondre ne laisse
 * pas de trace. Une erreur d'écriture est signalée sans interrompre la séance.
 */
export function useJournalWriter(session: SessionRecord) {
  const queue = useRef<Promise<void>>(Promise.resolve());
  const started = useRef(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const run = useCallback((action: () => Promise<void>) => {
    queue.current = queue.current.then(action).catch((error: unknown) => {
      console.error('Enregistrement impossible', error);
      setSaveFailed(true);
    });
  }, []);

  const recordAttempt = useCallback(
    (attempt: Attempt) =>
      run(async () => {
        if (!started.current) {
          await journal.startSession(session);
          started.current = true;
        }
        await journal.addAttempt(attempt);
      }),
    [run, session],
  );

  const recordEvent = useCallback(
    (event: ProgressEvent) => run(() => journal.addEvent(event)),
    [run],
  );

  const endSession = useCallback(
    () =>
      run(async () => {
        if (started.current) await journal.endSession(session.id, Date.now());
      }),
    [run, session],
  );

  return { recordAttempt, recordEvent, endSession, saveFailed };
}
