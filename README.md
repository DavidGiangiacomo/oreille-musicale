# Oreille musicale

Application web et Android pour entraîner son oreille musicale : reconnaissance d'intervalles, d'accords, de gammes et de modes, difficulté progressive, suivi de progression et révisions espacées.

**Essayer** : <https://davidgiangiacomo.github.io/oreille-musicale/> (parcours Intervalles, Triades, Septièmes, Renversements, Gammes et Modes, séance du jour avec révisions espacées, entraînement libre).

Le projet avance jalon par jalon. La conception est décrite dans le [document de conception](docs/DESIGN.md), et le plan de réalisation suit les [issues](https://github.com/DavidGiangiacomo/oreille-musicale/issues).

## Développement

Prérequis : Node.js 22 ou plus récent.

```sh
npm ci            # installe les dépendances
npm run dev       # serveur de développement sur http://localhost:5173
```

| Commande               | Rôle                                                 |
| ---------------------- | ---------------------------------------------------- |
| `npm run lint`         | ESLint et vérification du format (Prettier)          |
| `npm run format`       | Met en forme le code                                 |
| `npm run typecheck`    | Vérifie les types                                    |
| `npm test`             | Lance les tests (Vitest)                             |
| `npm run e2e`          | Tests de bout en bout (Playwright, son coupé)        |
| `npm run build`        | Construit l'appli dans `dist/`                       |
| `npm run android:sync` | Construit l'appli et la copie dans le projet Android |

Le code est organisé en couches (§10.3 du document de conception) :

- `src/core` : cœur métier en TypeScript pur, sans DOM, sans audio ni React : théorie musicale, génération des questions, curriculum, progression, révisions espacées (FSRS) et séance du jour.
- `src/audio` : moteur audio Web Audio et échantillons.
- `src/data` : journal des réponses et réglages, enregistrés dans le navigateur (IndexedDB, via Dexie).
- `src/platform` : fonctions propres au web ou à Android (stockage persistant…).
- `src/ui` : interface React.
- `android/` : projet Android généré par Capacitor.

Les règles d'isolation de `src/core` sont vérifiées par ESLint et par `tsconfig.core.json`.

Les tests de bout en bout (`e2e/`) lancent le serveur de développement avec un moteur audio silencieux (`VITE_FAKE_AUDIO=1`) et simulent l'horloge pour enchaîner plusieurs jours de révisions. Avant la première exécution : `npx playwright install chromium`.

## Hors-ligne, sauvegarde et synchronisation

La version web s'installe sur l'écran d'accueil (« Installer » ou « Ajouter à l'écran d'accueil ») et fonctionne ensuite sans connexion : l'appli est mise en cache à la première visite, les sons de chaque timbre à leur première écoute. La progression reste sur l'appareil ; la carte « Sauvegarde » de l'accueil permet de l'exporter dans un fichier et de l'importer sur un autre appareil.

La carte « Synchronisation » relie tes appareils, sans compte ni e-mail : le premier crée une clé, que l'on saisit sur les autres. Les données sont chiffrées sur l'appareil avant l'envoi ; le serveur ([`server/`](server/README.md), un Cloudflare Worker) ne voit que des blocs illisibles. Voir aussi la [politique de confidentialité](PRIVACY.md).

## Android

**Installer l'appli** : télécharger l'APK de la dernière version sur la page [Releases](https://github.com/DavidGiangiacomo/oreille-musicale/releases), l'ouvrir sur le téléphone et autoriser l'installation depuis cette source. Une nouvelle version s'installe par-dessus l'ancienne, sans perdre la progression.

**Publier une version** :

1. Augmenter la version dans `package.json` (par exemple `npm version 0.2.0 --no-git-tag-version`), puis fusionner dans `main`. Le code de version Android s'en déduit (1.2.3 → 10203).
2. Onglet _Actions_ → workflow « Publication » → _Run workflow_ sur `main`. Il construit l'APK signé, vérifie sa signature et crée la Release `v<version>` avec l'APK et son empreinte SHA-256.

La clé de signature n'est jamais dans le dépôt : le workflow la lit dans quatre secrets du dépôt (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). Sans la même clé, une mise à jour ne pourrait pas s'installer par-dessus la version précédente : garder le fichier `.jks` et ses mots de passe en lieu sûr.

**APK de test** : construit à chaque push par le workflow « Android » (onglet _Actions_, artefact `oreille-musicale-apk-debug`). Signé avec une clé de debug, il ne peut pas être mis à jour par une version publiée : exporter sa progression, le désinstaller, installer la version publiée, puis importer la sauvegarde.

Pour construire en local, il faut Java 21 et le SDK Android (ou Android Studio) :

```sh
npm run android:sync
cd android && ./gradlew assembleDebug
```

## Licence

Oreille musicale est un logiciel libre, distribué sous les termes de la [GNU General Public License](LICENSE), version 3 ou (à votre choix) toute version ultérieure.

Les sons de piano proviennent du _Salamander Grand Piano_ d'Alexander Holm (CC BY 3.0), ceux du vibraphone et des cordes des bibliothèques libres de Versilian Studios (CC0) : voir les [crédits](CREDITS.md).

## Soutenir le projet

L'appli est gratuite et le restera. Si elle vous est utile, vous pouvez soutenir son développement sur [Ko-fi](https://ko-fi.com/davidgiangiacomobaudchon).
