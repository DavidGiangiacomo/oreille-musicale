import type { InstrumentId, NoteEvent } from '../core/exercise/rendition';
import { renditionDuration } from '../core/exercise/rendition';
import type { AudioEngine, PlaybackHandle } from './engine';

/**
 * Moteur silencieux pour les tests de bout en bout (docs/DESIGN.md §10.10) : rien
 * n'est chargé ni joué, mais les durées sont respectées, si bien que le temps de
 * réponse se mesure comme avec le vrai moteur.
 */
export class FakeAudioEngine implements AudioEngine {
  readonly played: NoteEvent[][] = [];
  #loaded = new Set<InstrumentId>();
  #running = false;

  get running(): boolean {
    return this.#running;
  }

  unlock(): Promise<void> {
    this.#running = true;
    return Promise.resolve();
  }

  load(instrument: InstrumentId, onProgress?: (ratio: number) => void): Promise<void> {
    this.#loaded.add(instrument);
    onProgress?.(1);
    return Promise.resolve();
  }

  isLoaded(instrument: InstrumentId): boolean {
    return this.#loaded.has(instrument);
  }

  play(notes: readonly NoteEvent[]): PlaybackHandle {
    this.played.push([...notes]);
    const duration = renditionDuration(notes);
    return {
      startTime: 0,
      duration,
      notesEndAt: performance.now() + duration * 1000,
      finished: Promise.resolve(),
      stop: () => {},
    };
  }

  stopAll(): void {}

  suspend(): Promise<void> {
    this.#running = false;
    return Promise.resolve();
  }

  setVolume(): void {}
}
