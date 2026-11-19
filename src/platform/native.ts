import { Capacitor } from '@capacitor/core';

/** Vrai dans l'application Android (Capacitor), faux sur le web. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
