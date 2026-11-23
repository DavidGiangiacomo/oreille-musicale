import type { ReactNode } from 'react';
import { ScreenHeader } from '../components/ScreenParts';
import { card, cardTitle, muted } from '../styles';

const REPOSITORY = 'https://github.com/DavidGiangiacomo/oreille-musicale';
/** Page de dons (§10.11) : seulement ici, jamais pendant les exercices. */
const DONATIONS = 'https://ko-fi.com/davidgiangiacomobaudchon';

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="underline underline-offset-2" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/** À propos : confidentialité (§10.11), crédits, licence et dons. */
export function AboutScreen() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <ScreenHeader backTo="/" backLabel="Accueil" title="À propos" />

      <section className={card} aria-labelledby="confidentialite">
        <h2 id="confidentialite" className={cardTitle}>
          Confidentialité
        </h2>
        <p className="font-semibold">
          Aucune donnée personnelle n’est collectée : ni compte, ni publicité, ni traceur.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            Ta progression (réponses, étapes, réglages) est enregistrée sur cet appareil. Elle ne le
            quitte que si tu actives la synchronisation, chiffrée avant l’envoi : le serveur ne peut
            pas la lire, et ta clé ne quitte jamais tes appareils.
          </li>
          <li>
            Le serveur de synchronisation tourne chez Cloudflare, qui peut enregistrer des données
            techniques de connexion (adresse IP) ; tu peux y effacer tes données à tout moment.
          </li>
          <li>Le rappel quotidien, sur Android, est programmé sur le téléphone lui-même.</li>
          <li>
            Une sauvegarde n’est envoyée nulle part : c’est toi qui choisis où enregistrer ou
            partager le fichier.
          </li>
          <li>
            La version web est hébergée par GitHub Pages, qui peut enregistrer des données
            techniques de connexion selon sa propre politique. L’application Android fonctionne sans
            connexion.
          </li>
          <li>Ni micro, ni caméra, ni position, ni contacts, ni mesure d’audience.</li>
          <li>
            Pour tout effacer : désinstalle l’application, ou efface les données du site dans ton
            navigateur (exporte d’abord ta progression si tu veux la garder).
          </li>
        </ul>
        <p className={`text-sm ${muted}`}>
          Texte complet :{' '}
          <External href={`${REPOSITORY}/blob/main/PRIVACY.md`}>
            politique de confidentialité
          </External>
          .
        </p>
      </section>

      <section className={card} aria-labelledby="credits">
        <h2 id="credits" className={cardTitle}>
          Crédits
        </h2>
        <p>
          Sons de piano : <i>Salamander Grand Piano</i>, Alexander Holm, licence{' '}
          <External href="https://creativecommons.org/licenses/by/3.0/deed.fr">CC BY 3.0</External>,
          échantillons adaptés pour l’appli.
        </p>
        <p>
          Vibraphone : <i>Versilian Community Sample Library</i>, Sam Gossner ; cordes :{' '}
          <i>VS Chamber Orchestra 2: Community Edition</i>, Versilian Studios. Domaine public (
          <External href="https://creativecommons.org/publicdomain/zero/1.0/deed.fr">CC0</External>
          ), échantillons adaptés pour l’appli.
        </p>
        <p>
          Bibliothèques : React, React Router, Tonal, ts-fsrs, Dexie, Capacitor, Workbox, Tailwind
          CSS (licences MIT et Apache 2.0). Détail dans le fichier{' '}
          <External href={`${REPOSITORY}/blob/main/CREDITS.md`}>CREDITS.md</External>.
        </p>
      </section>

      <section className={card} aria-labelledby="licence">
        <h2 id="licence" className={cardTitle}>
          Logiciel libre
        </h2>
        <p>
          Oreille musicale est un logiciel libre et gratuit, sous licence{' '}
          <External href="https://www.gnu.org/licenses/gpl-3.0.fr.html">GNU GPL v3</External> ou
          ultérieure. Le code source est sur <External href={REPOSITORY}>GitHub</External>.
        </p>
        <p className={`text-sm ${muted}`}>Version {__APP_VERSION__}</p>
      </section>

      <section className={card} aria-labelledby="soutenir">
        <h2 id="soutenir" className={cardTitle}>
          Soutenir le projet
        </h2>
        <p>
          L’appli est gratuite et le restera. Si elle t’est utile, tu peux soutenir son
          développement par un don : <External href={DONATIONS}>page Ko-fi</External>.
        </p>
        <p className={`text-sm ${muted}`}>
          Ko-fi est un service extérieur, avec sa propre politique de confidentialité ; l’appli ne
          lui transmet rien.
        </p>
      </section>
    </main>
  );
}
