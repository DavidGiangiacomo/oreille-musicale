import { createJournal, createSyncStore, openDatabase } from '../data';

/** Base unique de l'application, dans IndexedDB. */
const database = openDatabase();

/** Journal de l'application. */
export const journal = createJournal(database);

/** Côté appareil de la synchronisation (§10.8). */
export const syncStore = createSyncStore(database);

/** Changements du journal et des réglages, pour déclencher une synchronisation. */
export const journalSize = () =>
  Promise.all([
    database.sessions.count(),
    database.attempts.count(),
    database.events.count(),
    database.settingChanges.count(),
  ]).then((counts) => counts.join(':'));
