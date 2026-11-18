import { IntervalDemo } from '../demo/IntervalDemo';

export function HomeScreen() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Oreille musicale</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Prototype audio : écoute un intervalle tiré au hasard, avec son nom.
        </p>
      </header>

      <IntervalDemo />

      <footer className="text-xs text-slate-500 dark:text-slate-400">
        <p>
          Version de démonstration (jalon J0). Les parcours d'apprentissage arrivent avec les
          prochaines versions.
        </p>
        <p className="mt-2">
          Sons de piano : <i>Salamander Grand Piano</i>, Alexander Holm, licence{' '}
          <a
            className="underline"
            href="https://creativecommons.org/licenses/by/3.0/deed.fr"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 3.0
          </a>
          . Logiciel libre sous licence{' '}
          <a
            className="underline"
            href="https://github.com/DavidGiangiacomo/oreille-musicale"
            target="_blank"
            rel="noreferrer"
          >
            GNU GPL v3
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
