import { useRef, useState } from 'react';
import {
  backupFileName,
  createBackup,
  parseBackup,
  type Backup,
  type BackupSummary,
} from '../../core/backup';
import { CURRICULUM_VERSION } from '../../core/curriculum';
import { SCHEMA_VERSIONS } from '../../data/database';
import { saveTextFile } from '../../platform/files';
import { isNativeApp } from '../../platform/native';
import { journal } from '../data';
import { card, cardTitle, muted, primaryButton, secondaryButton } from '../styles';

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });
const SCHEMA_VERSION = SCHEMA_VERSIONS.at(-1)?.version ?? 0;

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'confirm'; backup: Backup; summary: BackupSummary }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

/**
 * Sauvegarde de la progression (§10.6) : exporter un fichier, ou importer celui
 * d'un autre appareil (après confirmation, il remplace tout).
 */
export function BackupPanel() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const input = useRef<HTMLInputElement>(null);

  async function exportData() {
    setState({ kind: 'busy' });
    try {
      const at = Date.now();
      const backup = createBackup(await journal.exportAll(), {
        schemaVersion: SCHEMA_VERSION,
        appVersion: __APP_VERSION__,
        curriculumVersion: CURRICULUM_VERSION,
        at,
      });
      await saveTextFile(
        backupFileName(at),
        JSON.stringify(backup),
        'Sauvegarde d’Oreille musicale',
      );
      setState({
        kind: 'done',
        message: isNativeApp()
          ? 'Sauvegarde prête : choisis où l’enregistrer ou à qui l’envoyer.'
          : 'Sauvegarde téléchargée.',
      });
    } catch (error) {
      // Partage annulé par l'utilisateur : rien à signaler.
      if (error instanceof Error && /cancel/i.test(error.message)) {
        setState({ kind: 'idle' });
        return;
      }
      setState({ kind: 'error', message: 'La sauvegarde n’a pas pu être créée.' });
    }
  }

  async function readFile(file: File) {
    const parsed = parseBackup(await file.text());
    setState(
      parsed.ok
        ? { kind: 'confirm', backup: parsed.backup, summary: parsed.summary }
        : { kind: 'error', message: parsed.error },
    );
  }

  async function importData(backup: Backup) {
    setState({ kind: 'busy' });
    try {
      await journal.replaceAll(backup);
      // Repartir de zéro : réglages, progression et révisions sont relus du journal.
      window.location.reload();
    } catch {
      setState({
        kind: 'error',
        message: 'L’import a échoué ; les données de cet appareil n’ont pas changé.',
      });
    }
  }

  return (
    <section className={card} aria-labelledby="sauvegarde">
      <h2 id="sauvegarde" className={cardTitle}>
        Sauvegarde
      </h2>
      <p className={muted}>
        Ta progression reste sur cet appareil. Pour la conserver ou la passer sur un autre appareil,
        exporte-la dans un fichier, puis importe ce fichier de l’autre côté.
      </p>

      {state.kind === 'confirm' ? (
        <div className="flex flex-col gap-3 rounded-xl bg-amber-50 p-4 dark:bg-amber-950/40">
          <p>
            Sauvegarde du {DATE.format(state.summary.exportedAt)} : {state.summary.sessions} séance
            {state.summary.sessions > 1 ? 's' : ''} et {state.summary.attempts} réponse
            {state.summary.attempts > 1 ? 's' : ''}.
          </p>
          <p className="font-semibold">
            Elle remplacera toutes les données de cet appareil : progression, révisions et réglages.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={primaryButton}
              onClick={() => void importData(state.backup)}
            >
              Remplacer mes données
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setState({ kind: 'idle' })}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={secondaryButton}
            disabled={state.kind === 'busy'}
            onClick={() => void exportData()}
          >
            Exporter mes données
          </button>
          <button
            type="button"
            className={secondaryButton}
            disabled={state.kind === 'busy'}
            onClick={() => input.current?.click()}
          >
            Importer une sauvegarde
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Fichier de sauvegarde à importer"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void readFile(file);
        }}
      />
      {state.kind === 'done' && <p role="status">{state.message}</p>}
      {state.kind === 'error' && (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {state.message}
        </p>
      )}
    </section>
  );
}
