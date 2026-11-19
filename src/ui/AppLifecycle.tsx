import { useEffect } from 'react';
import type { createHashRouter } from 'react-router';
import { exitApp, listenToLifecycle } from '../platform/lifecycle';
import { audioEngine } from './audio';

type Router = ReturnType<typeof createHashRouter>;

/** Écrans de séance : les quitter par le bouton retour demande confirmation (§10.7). */
const SESSION_PATHS = ['/etape/', '/seance', '/serie'];

/**
 * Cycle de vie de l'appli : bouton retour d'Android (navigation interne, sortie
 * depuis l'accueil), son coupé en arrière-plan et rétabli au retour.
 */
export function AppLifecycle({ router }: { router: Router }) {
  useEffect(
    () =>
      listenToLifecycle({
        onBack: () => {
          const path = router.state.location.pathname;
          if (path === '/' || path === '/bienvenue') {
            exitApp();
            return;
          }
          const inSession = SESSION_PATHS.some((prefix) => path.startsWith(prefix));
          if (
            inSession &&
            !window.confirm('Quitter la séance ? Les réponses déjà données sont enregistrées.')
          ) {
            return;
          }
          void (window.history.length > 1 ? router.navigate(-1) : router.navigate('/'));
        },
        onPause: () => void audioEngine.suspend(),
        onResume: () => void audioEngine.unlock().catch(() => undefined),
      }),
    [router],
  );
  return null;
}
