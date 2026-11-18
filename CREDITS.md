# Crédits

Oreille musicale est distribuée sous licence [GNU GPL v3 ou ultérieure](LICENSE). Elle s'appuie sur les travaux suivants, dont les licences (MIT, Apache 2.0, CC BY) sont compatibles avec la GPL v3.

## Sons

| Élément                                    | Auteur         | Licence                                                   | Source                                                                                              |
| ------------------------------------------ | -------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| _Salamander Grand Piano_ (piano Yamaha C5) | Alexander Holm | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Version publiée par Tone.js : [Tonejs/audio](https://github.com/Tonejs/audio), dossier `salamander` |

Les échantillons ont été modifiés pour l'appli (sélection de notes, mono, durée de 5 s, sonie égalisée, réencodage). Le détail se trouve dans [`public/samples/piano/LICENSE.txt`](public/samples/piano/LICENSE.txt), et le traitement dans [`scripts/prepare-piano-samples.mjs`](scripts/prepare-piano-samples.mjs).

## Bibliothèques incluses dans l'appli

| Bibliothèque                              | Rôle                                                        | Licence    |
| ----------------------------------------- | ----------------------------------------------------------- | ---------- |
| [React](https://react.dev) et React DOM   | Interface                                                   | MIT        |
| [React Router](https://reactrouter.com)   | Navigation                                                  | MIT        |
| [Tonal](https://github.com/tonaljs/tonal) | Théorie musicale (orthographe des notes et des intervalles) | MIT        |
| [Capacitor](https://capacitorjs.com)      | Application Android                                         | MIT        |
| [Dexie](https://dexie.org)                | Stockage local (IndexedDB)                                  | Apache 2.0 |
| [Tailwind CSS](https://tailwindcss.com)   | Styles                                                      | MIT        |

## Outils de développement

Vite, TypeScript, Vitest, fast-check, ESLint et Prettier servent à construire et à tester l'appli. Ils ne sont pas inclus dans ce qui est distribué.
