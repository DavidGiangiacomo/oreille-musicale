import { Link, Navigate } from 'react-router';
import { BackupPanel } from '../home/BackupPanel';
import { ContinueCard } from '../home/ContinueCard';
import { DailyCard } from '../home/DailyCard';
import { HistoryList } from '../home/HistoryList';
import { PreferencesPanel } from '../home/PreferencesPanel';
import { SeriesLauncher } from '../home/SeriesLauncher';
import { SyncPanel } from '../home/SyncPanel';
import { useSettings } from '../settings/settingsContext';

export function HomeScreen() {
  const { settings, loaded } = useSettings();
  if (loaded && !settings.onboardingDone) return <Navigate to="/bienvenue" replace />;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Oreille musicale</h1>
        <nav aria-label="Navigation principale" className="flex gap-4 text-sm font-medium">
          <Link to="/parcours" className="underline underline-offset-4">
            Parcours
          </Link>
          <Link to="/statistiques" className="underline underline-offset-4">
            Statistiques
          </Link>
        </nav>
        <p className="text-slate-600 dark:text-slate-400">
          Écoute, reconnais ce que tu entends, et recommence : l'oreille se forme un peu chaque
          jour.
        </p>
      </header>

      <DailyCard />
      <ContinueCard />
      <SeriesLauncher />
      <HistoryList />
      <PreferencesPanel />
      <SyncPanel />
      <BackupPanel />

      <footer className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/a-propos" className="text-sm font-medium underline underline-offset-4">
          À propos, confidentialité et crédits
        </Link>
        <p>
          Version {__APP_VERSION__}. Logiciel libre sous licence GNU GPL v3 ; sons de piano{' '}
          <i>Salamander Grand Piano</i> (Alexander Holm, CC BY 3.0).
        </p>
      </footer>
    </main>
  );
}
