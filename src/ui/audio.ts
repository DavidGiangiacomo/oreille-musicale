import { WebAudioEngine } from '../audio';

/** Moteur audio unique de l'application ; les échantillons sont servis avec elle. */
export const audioEngine = new WebAudioEngine({ baseUrl: import.meta.env.BASE_URL });
