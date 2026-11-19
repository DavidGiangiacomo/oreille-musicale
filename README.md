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

## Android

L'APK de test est construit à chaque push par le workflow « Android ». Pour le récupérer : onglet _Actions_, dernière exécution du workflow, artefact `oreille-musicale-apk-debug`. Il s'installe sur un téléphone après avoir autorisé l'installation d'applications de sources inconnues.

Pour construire en local, il faut Java 21 et le SDK Android (ou Android Studio) :

```sh
npm run android:sync
cd android && ./gradlew assembleDebug
```

## Licence

Oreille musicale est un logiciel libre, distribué sous les termes de la [GNU General Public License](LICENSE), version 3 ou (à votre choix) toute version ultérieure.

Les sons de piano proviennent du _Salamander Grand Piano_ d'Alexander Holm (CC BY 3.0) : voir les [crédits](CREDITS.md).
