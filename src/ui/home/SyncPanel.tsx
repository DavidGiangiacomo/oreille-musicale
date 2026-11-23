import { Fragment, useEffect, useId, useState, useSyncExternalStore, type FormEvent } from 'react';
import { canShareText, copyText, shareText } from '../../platform/share';
import { card, cardTitle, muted, primaryButton, secondaryButton } from '../styles';
import {
  createSyncKey,
  currentSyncKey,
  deleteServerData,
  disableSync,
  getSyncStatus,
  joinSyncKey,
  requestSync,
  subscribeSyncStatus,
  type SyncStatus,
} from '../sync';

const RELATIVE = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

function ago(at: number, now: number): string {
  const minutes = Math.round((at - now) / 60_000);
  if (minutes > -1) return 'à l’instant';
  if (minutes > -60) return RELATIVE.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return RELATIVE.format(hours, 'hour');
  return RELATIVE.format(Math.round(hours / 24), 'day');
}

function statusText(status: SyncStatus, now: number): string {
  if (status.state === 'syncing') return 'Synchronisation en cours…';
  const last =
    'lastSyncAt' in status && status.lastSyncAt !== null
      ? `Dernière synchronisation ${ago(status.lastSyncAt, now)}.`
      : 'Pas encore synchronisé.';
  if (status.state === 'offline') return `Hors ligne : elle reprendra au retour du réseau. ${last}`;
  if (status.state === 'error') return `${status.message} ${last}`;
  return last;
}

/** La clé, en grand, avec de quoi la recopier sur un autre appareil. */
function KeyBox({ syncKey }: { syncKey: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-amber-50 p-4 dark:bg-amber-950/40">
      <p className="text-sm font-medium">Clé de synchronisation</p>
      {/* Retour à la ligne seulement après un tiret, jamais au milieu d'un groupe. */}
      <p className="font-mono text-lg font-semibold tracking-wider select-all">
        {syncKey.split('-').map((group, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <>
                -<wbr />
              </>
            )}
            <span className="whitespace-nowrap">{group}</span>
          </Fragment>
        ))}
      </p>
      <p className="text-sm">
        Saisis-la sur ton autre appareil, dans « J’ai déjà une clé ». Garde-la en lieu sûr : elle
        seule permet de relier tes appareils et de relire tes données. Personne d’autre ne peut la
        retrouver.
      </p>
      <div className={`grid gap-2 ${canShareText() ? 'grid-cols-2' : ''}`}>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => void copyText(syncKey).then(setCopied)}
        >
          Copier la clé
        </button>
        {canShareText() && (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => void shareText('Clé de synchronisation d’Oreille musicale', syncKey)}
          >
            Partager
          </button>
        )}
      </div>
      {copied !== null && (
        <p role="status" className="text-sm">
          {copied ? 'Clé copiée.' : 'La copie a été refusée : recopie la clé à la main.'}
        </p>
      )}
    </div>
  );
}

function JoinForm({ onCancel }: { onCancel: () => void }) {
  const inputId = useId();
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setInvalid(!(await joinSyncKey(text)));
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
      <label htmlFor={inputId} className="font-medium">
        Clé de synchronisation
      </label>
      <input
        id={inputId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${inputId}-error` : undefined}
        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXX"
        className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 font-mono tracking-wider uppercase placeholder:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-400"
      />
      {invalid && (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-red-700 dark:text-red-300">
          Cette clé est incomplète ou mal recopiée.
        </p>
      )}
      <p className={`text-sm ${muted}`}>
        Tes données sur cet appareil seront fusionnées avec celles de tes autres appareils ; rien
        n’est effacé. Les réglages de tes autres appareils s’appliqueront ici.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" className={primaryButton}>
          Relier cet appareil
        </button>
        <button type="button" className={secondaryButton} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

type Confirm = 'disable' | 'delete' | null;

/** Synchronisation entre appareils (§10.8) : sans compte, chiffrée de bout en bout. */
export function SyncPanel() {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const [joining, setJoining] = useState(false);
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Le « il y a 3 minutes » se met à jour de lui-même.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (status.state === 'loading') return null;

  async function activate() {
    setShownKey(await createSyncKey());
  }

  async function toggleKey() {
    setShownKey(shownKey ? null : await currentSyncKey());
  }

  async function confirmAction() {
    setFailure(null);
    try {
      if (confirm === 'delete') await deleteServerData();
      else await disableSync();
      setConfirm(null);
      setShownKey(null);
    } catch {
      setFailure('Le serveur est injoignable : réessaie une fois connecté.');
    }
  }

  return (
    <section className={card} aria-labelledby="synchronisation">
      <h2 id="synchronisation" className={cardTitle}>
        Synchronisation
      </h2>

      {status.state === 'off' ? (
        <>
          <p className={muted}>
            Retrouve ta progression sur tous tes appareils, sans compte ni e-mail : une clé relie
            tes appareils, et tes données sont chiffrées avant de quitter celui-ci. Le serveur ne
            peut pas les lire.
          </p>
          {joining ? (
            <JoinForm onCancel={() => setJoining(false)} />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className={primaryButton} onClick={() => void activate()}>
                Activer la synchronisation
              </button>
              <button type="button" className={secondaryButton} onClick={() => setJoining(true)}>
                J’ai déjà une clé
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p
            role="status"
            className={status.state === 'error' ? 'text-red-700 dark:text-red-300' : muted}
          >
            {statusText(status, now)}
          </p>
          {shownKey && <KeyBox syncKey={shownKey} />}
          {confirm ? (
            <div className="flex flex-col gap-3 rounded-xl bg-amber-50 p-4 dark:bg-amber-950/40">
              <p className="font-semibold">
                {confirm === 'delete'
                  ? 'Effacer tes données du serveur ? Tes appareils gardent les leurs. Désactive aussi la synchronisation sur tes autres appareils, sinon ils les renverront.'
                  : 'Arrêter la synchronisation sur cet appareil ? Ses données restent ici, et sur tes autres appareils.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={primaryButton}
                  onClick={() => void confirmAction()}
                >
                  {confirm === 'delete' ? 'Effacer' : 'Désactiver'}
                </button>
                <button type="button" className={secondaryButton} onClick={() => setConfirm(null)}>
                  Annuler
                </button>
              </div>
              {failure && (
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                  {failure}
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={secondaryButton}
                disabled={status.state === 'syncing'}
                onClick={() => void requestSync()}
              >
                Synchroniser maintenant
              </button>
              <button type="button" className={secondaryButton} onClick={() => void toggleKey()}>
                {shownKey ? 'Masquer la clé' : 'Afficher la clé'}
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setConfirm('disable')}
              >
                Désactiver sur cet appareil
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setConfirm('delete')}
              >
                Effacer mes données du serveur
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
