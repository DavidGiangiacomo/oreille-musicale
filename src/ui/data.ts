import { createJournal, openDatabase } from '../data';

/** Journal unique de l'application, enregistré dans IndexedDB. */
export const journal = createJournal(openDatabase());
