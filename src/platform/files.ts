import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from './native';

/**
 * Enregistre un fichier texte produit par l'appli : téléchargement sur le web ;
 * sur Android, fichier temporaire proposé au partage (Drive, Fichiers, e-mail…).
 */
export async function saveTextFile(name: string, text: string, title: string): Promise<void> {
  if (isNativeApp()) {
    const { uri } = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title, files: [uri], dialogTitle: title });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Laisse au navigateur le temps de lancer le téléchargement.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
