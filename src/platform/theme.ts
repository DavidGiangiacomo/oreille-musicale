export type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'oreille:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Applique le thème à la page (attribut data-theme de <html>) et le garde en
 * mémoire pour le prochain démarrage ; « système » suit le réglage de l'appareil,
 * y compris s'il change pendant l'utilisation. Renvoie de quoi arrêter de suivre.
 */
export function applyTheme(choice: ThemeChoice): () => void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Stockage indisponible : le thème s'applique quand même pour cette visite.
  }
  const media = window.matchMedia(DARK_QUERY);
  const update = () => {
    const dark = choice === 'dark' || (choice === 'system' && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  };
  update();
  if (choice !== 'system') return () => undefined;
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}
