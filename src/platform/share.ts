import { Share } from '@capacitor/share';
import { isNativeApp } from './native';

/** Le partage de texte est-il disponible (Android, ou navigateur qui le propose) ? */
export function canShareText(): boolean {
  return isNativeApp() || (typeof navigator !== 'undefined' && 'share' in navigator);
}

/** Ouvre la feuille de partage du système avec ce texte. Faux si l'utilisateur annule. */
export async function shareText(title: string, text: string): Promise<boolean> {
  try {
    if (isNativeApp()) await Share.share({ title, text, dialogTitle: title });
    else await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
}

/** Copie un texte dans le presse-papiers. Faux si le navigateur le refuse. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
