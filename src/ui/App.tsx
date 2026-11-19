import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { isNativeApp } from '../platform/native';
import { UpdatePrompt } from './components/UpdatePrompt';
import { CourseScreen } from './course/CourseScreen';
import { DailySessionScreen } from './daily/DailySessionScreen';
import { WelcomeScreen } from './onboarding/WelcomeScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SeriesScreen } from './series/SeriesScreen';
import { SettingsProvider } from './settings/SettingsProvider';
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
  { path: '*', element: <Navigate to="/" replace /> },
]);

// Le service worker ne sert qu'à la version web publiée.
const withServiceWorker = import.meta.env.PROD && !isNativeApp();

export function App() {
  return (
    <SettingsProvider>
      <RouterProvider router={router} />
      {withServiceWorker && <UpdatePrompt />}
    </SettingsProvider>
  );
}
