import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { isNativeApp } from '../platform/native';
import { AppLifecycle } from './AppLifecycle';
import { UpdatePrompt } from './components/UpdatePrompt';
import { ReminderScheduler } from './ReminderScheduler';
import { CourseScreen } from './course/CourseScreen';
import { DailySessionScreen } from './daily/DailySessionScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import { AboutScreen } from './screens/AboutScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SeriesScreen } from './series/SeriesScreen';
import { SettingsProvider } from './settings/SettingsProvider';
import { StatsScreen } from './stats/StatsScreen';
import { StepScreen } from './step/StepScreen';

// Routage par « # » : GitHub Pages ne sait pas rediriger les routes vers index.html,
// et la même construction sert telle quelle dans l'application Android.
const router = createHashRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/bienvenue', element: <WelcomeScreen /> },
  { path: '/parcours', element: <CourseScreen /> },
  { path: '/seance', element: <DailySessionScreen /> },
  { path: '/etape/:stepId', element: <StepScreen /> },
  { path: '/serie', element: <SeriesScreen /> },
  { path: '/a-propos', element: <AboutScreen /> },
  { path: '/statistiques', element: <StatsScreen /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

// Le service worker ne sert qu'à la version web publiée ; les rappels, qu'à Android.
const native = isNativeApp();
const withServiceWorker = import.meta.env.PROD && !native;

export function App() {
  return (
    <SettingsProvider>
      <RouterProvider router={router} />
      <AppLifecycle router={router} />
      {native && <ReminderScheduler />}
      {withServiceWorker && <UpdatePrompt />}
    </SettingsProvider>
  );
}
