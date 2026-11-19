import { App } from '@capacitor/app';
import { isNativeApp } from './native';

export interface LifecycleHandlers {
  /** Bouton retour d'Android. */
  onBack: () => void;
  /** L'appli passe en arrière-plan (ou la page est cachée, sur le web). */
  onPause: () => void;
  onResume: () => void;
}

/** Écoute le cycle de vie de l'appli ; renvoie de quoi arrêter l'écoute. */
export function listenToLifecycle(handlers: LifecycleHandlers): () => void {
  if (!isNativeApp()) {
    const onVisibility = () =>
      document.visibilityState === 'hidden' ? handlers.onPause() : handlers.onResume();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }
  const listeners = [
    App.addListener('backButton', () => handlers.onBack()),
    App.addListener('pause', () => handlers.onPause()),
    App.addListener('resume', () => handlers.onResume()),
  ];
  return () => listeners.forEach((listener) => void listener.then((handle) => handle.remove()));
}

/** Quitte l'application Android (sans effet sur le web). */
export function exitApp(): void {
  if (isNativeApp()) void App.exitApp();
}
