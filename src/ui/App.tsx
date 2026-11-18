import { createHashRouter, RouterProvider } from 'react-router';
import { HomeScreen } from './screens/HomeScreen';

// Routage par « # » : GitHub Pages ne sait pas rediriger les routes vers index.html,
// et la même construction sert telle quelle dans l'application Android.
const router = createHashRouter([{ path: '/', element: <HomeScreen /> }]);

export function App() {
  return <RouterProvider router={router} />;
}
