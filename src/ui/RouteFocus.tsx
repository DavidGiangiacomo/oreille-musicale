import { useEffect } from 'react';
import type { createHashRouter } from 'react-router';

type Router = ReturnType<typeof createHashRouter>;

const APP_NAME = 'Oreille musicale';
const RETRY_MS = 50;
const MAX_TRIES = 20;

/**
 * Changement d'écran (§9.6) : le titre de la page reprend celui de l'écran
 * (WCAG 2.4.2), et le focus passe sur ce titre pour que le lecteur d'écran
 * annonce le nouvel écran au lieu de rester sur un lien qui a disparu.
 */
export function RouteFocus({ router }: { router: Router }) {
  useEffect(() => {
    let path = router.state.location.pathname;
    let timer: number | undefined;

    const settle = (previous: Element | null, moveFocus: boolean, tries = MAX_TRIES) => {
      const heading = document.querySelector<HTMLElement>('main h1');
      // Attendre que le nouvel écran soit affiché (écrans qui se chargent, transitions).
      if ((!heading || heading === previous) && tries > 0) {
        timer = window.setTimeout(() => settle(previous, moveFocus, tries - 1), RETRY_MS);
        return;
      }
      if (!heading) return;
      const title = heading.textContent?.trim();
      document.title = path === '/' || !title ? APP_NAME : `${title} · ${APP_NAME}`;
      if (moveFocus) {
        heading.tabIndex = -1;
        heading.focus();
      }
    };

    settle(null, false);
    const unsubscribe = router.subscribe((state) => {
      if (state.location.pathname === path) return;
      path = state.location.pathname;
      window.clearTimeout(timer);
      const previous = document.querySelector('main h1');
      timer = window.setTimeout(() => settle(previous, true), 0);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [router]);
  return null;
}
