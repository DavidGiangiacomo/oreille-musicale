/**
 * Demande au navigateur de ne pas effacer les données de l'appli quand l'espace
 * manque (§10.6). Sans effet, mais sans erreur, là où l'API n'existe pas.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = navigator.storage;
    if (!storage?.persist) return false;
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
