import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { HomeScreen } from './screens/HomeScreen';
import { SeriesScreen } from './series/SeriesScreen';
import { SettingsProvider } from './settings/SettingsProvider';

// Routage par « # » : GitHub Pages ne sait pas rediriger les routes vers index.html,
// et la même construction sert telle quelle dans l'application Android.
const router = createHashRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/serie', element: <SeriesScreen /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  );
}
