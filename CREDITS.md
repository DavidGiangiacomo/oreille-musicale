# Crédits

Oreille musicale est distribuée sous licence [GNU GPL v3 ou ultérieure](LICENSE). Elle s'appuie sur les travaux suivants, dont les licences (MIT, Apache 2.0, CC BY, CC0) sont compatibles avec la GPL v3.

## Sons

| Élément                                                                                   | Auteur                                         | Licence                                                       | Source                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| _Salamander Grand Piano_ (piano Yamaha C5)                                                | Alexander Holm                                 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)     | Version publiée par Tone.js : [Tonejs/audio](https://github.com/Tonejs/audio), dossier `salamander`                                              |
| Vibraphone (mailloches douces), _Versilian Community Sample Library_                      | Sam Gossner, Versilian Studios                 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [sgossner/VCSL](https://github.com/sgossner/VCSL), dossier `Idiophones/Struck Idiophones/Vibraphone`                                             |
| Cordes (pupitres de violoncelles et d'altos), _VS Chamber Orchestra 2: Community Edition_ | Versilian Studios (Sam Gossner, Simon Dalzell) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [sgossner/VSCO-2-CE](https://github.com/sgossner/VSCO-2-CE), dossier `Strings` ; [page du projet](https://versilian-studios.com/vsco-community/) |

Les échantillons ont été modifiés pour l'appli (sélection de notes, mono, durée limitée, sonie égalisée, réencodage). Le détail se trouve dans le fichier `LICENSE.txt` de chaque dossier de [`public/samples`](public/samples), et le traitement dans [`scripts/prepare-piano-samples.mjs`](scripts/prepare-piano-samples.mjs) et [`scripts/prepare-instrument-samples.mjs`](scripts/prepare-instrument-samples.mjs). Les sons sous CC0 n'exigent aucune mention ; Versilian Studios la demande, et nous la faisons volontiers.

## Bibliothèques incluses dans l'appli

| Bibliothèque                                                                                         | Rôle                                                        | Licence    |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------- |
| [React](https://react.dev) et React DOM                                                              | Interface                                                   | MIT        |
| [React Router](https://reactrouter.com)                                                              | Navigation                                                  | MIT        |
| [Tonal](https://github.com/tonaljs/tonal)                                                            | Théorie musicale (orthographe des notes et des intervalles) | MIT        |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)                                         | Révisions espacées (algorithme FSRS)                        | MIT        |
| [Capacitor](https://capacitorjs.com) et ses extensions (App, Filesystem, Share, Local Notifications) | Application Android                                         | MIT        |
| [Workbox](https://developer.chrome.com/docs/workbox)                                                 | Fonctionnement hors-ligne de la version web                 | MIT        |
| [Dexie](https://dexie.org)                                                                           | Stockage local (IndexedDB)                                  | Apache 2.0 |
| [Tailwind CSS](https://tailwindcss.com)                                                              | Styles                                                      | MIT        |

## Outils de développement

Vite, vite-plugin-pwa, TypeScript, Vitest, fast-check, Playwright, axe-core (audit d’accessibilité, MPL-2.0), Wrangler (déploiement du serveur de synchronisation), ESLint et Prettier servent à construire et à tester l'appli. Ils ne sont pas inclus dans ce qui est distribué.
