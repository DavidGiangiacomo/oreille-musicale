import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from './native';

/** Un seul rappel programmé à la fois, toujours sous le même identifiant. */
const REMINDER_ID = 1;

/** Les rappels n'existent que dans l'application Android. */
export function remindersAvailable(): boolean {
  return isNativeApp();
}

/** Demande l'autorisation d'afficher des notifications (Android 13 et plus). */
export async function requestReminderPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  const status = await LocalNotifications.checkPermissions();
  if (status.display === 'granted') return true;
  return (await LocalNotifications.requestPermissions()).display === 'granted';
}

/** Remplace le rappel programmé par celui-ci (ou l'annule seulement). */
export async function scheduleReminder(reminder: { at: number; body: string } | null) {
  if (!isNativeApp()) return;
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  if (!reminder) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: 'Oreille musicale',
        body: reminder.body,
        // Heure approximative suffisante : pas d'alarme exacte (§10.7).
        schedule: { at: new Date(reminder.at), allowWhileIdle: true },
        smallIcon: 'ic_stat_note',
        iconColor: '#F59E0B',
      },
    ],
  });
}
