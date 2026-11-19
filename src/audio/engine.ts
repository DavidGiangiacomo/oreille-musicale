import type { InstrumentId, NoteEvent } from '../core/exercise/rendition';
import { PIANO_SAMPLES, nearestSample, sampleUrl } from './samples';

export interface PlaybackHandle {
  /** Instant de début, sur l'horloge du contexte audio (secondes). */
  readonly startTime: number;
  /** Durée totale, relâchement compris (secondes). */
  readonly duration: number;
  /**
   * Instant où la dernière note cesse d'être tenue, sur l'horloge de
   * `performance.now()` (ms), latence de sortie comprise quand elle est connue.
   * Point de départ du temps de réponse.
   */
  readonly notesEndAt: number;
  /** Se résout quand toutes les notes ont fini de sonner, ou après `stop()`. */
  readonly finished: Promise<void>;
  /** Arrête la lecture par un fondu court. */
  stop(): void;
}

export interface PlayOptions {
  /** Instrument des notes qui n'en précisent pas ; piano par défaut. */
  instrument?: InstrumentId;
}

/** Moteur audio (docs/DESIGN.md §10.4) : joue des réalisations produites par le cœur. */
export interface AudioEngine {
  /** Débloque la sortie audio ; à appeler pendant un geste de l'utilisateur. */
  unlock(): Promise<void>;
  /** Vrai quand la sortie audio est débloquée et qu'une lecture serait entendue. */
  readonly running: boolean;
  /** Charge un instrument ; `onProgress` reçoit une proportion de 0 à 1. */
  load(instrument: InstrumentId, onProgress?: (ratio: number) => void): Promise<void>;
  isLoaded(instrument: InstrumentId): boolean;
  /** Joue une réalisation complète ; coupe d'abord ce qui joue encore. */
  play(notes: readonly NoteEvent[], options?: PlayOptions): PlaybackHandle;
  stopAll(): void;
  /** Volume général, de 0 à 1. */
  setVolume(volume: number): void;
}

export interface WebAudioEngineOptions {
  /** Base des URL des échantillons : « ./ » dans l'application. */
  baseUrl: string;
  /** Contexte à utiliser (tests, rendu hors ligne) ; sinon créé au premier besoin. */
  context?: BaseAudioContext;
  fetch?: typeof fetch;
}

interface Voice {
  source: AudioScheduledSourceNode;
  gain: GainNode;
  end: number;
}

/** Avance prise pour planifier une lecture, afin qu'aucune note ne soit en retard. */
const LOOKAHEAD = 0.05;
const ATTACK = 0.005;
const RELEASE = 0.25;
const FADE_OUT = 0.03;
/** Les échantillons sont normalisés à -25 LUFS : ce gain les ramène à un niveau confortable. */
const PIANO_GAIN = 1.6;
const PURE_GAIN = 0.32;
/** Bourdon : attaque et relâchement lents, gain faible (la vélocité l'abaisse encore). */
const DRONE_GAIN = 0.3;
const DRONE_ATTACK = 0.5;
const DRONE_RELEASE = 0.8;

export class WebAudioEngine implements AudioEngine {
  #context: BaseAudioContext | null;
  #output: GainNode | null = null;
  #volume = 1;
  #pureWave: PeriodicWave | null = null;
  #droneWave: PeriodicWave | null = null;
  readonly #piano = new Map<number, AudioBuffer>();
  #pianoLoading: Promise<void> | null = null;
  readonly #voices = new Set<Voice>();
  readonly #fetch: typeof fetch;
  readonly #baseUrl: string;

  constructor(options: WebAudioEngineOptions) {
    this.#baseUrl = options.baseUrl;
    this.#context = options.context ?? null;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  get context(): BaseAudioContext {
    this.#context ??= new AudioContext({ latencyHint: 'interactive' });
    return this.#context;
  }

  get running(): boolean {
    return this.#context?.state === 'running';
  }

  /** Latence entre la planification et le haut-parleur, quand le navigateur la donne. */
  #outputLatency(): number {
    const context = this.context;
    if (typeof AudioContext === 'undefined' || !(context instanceof AudioContext)) return 0;
    return (context.baseLatency || 0) + (context.outputLatency || 0);
  }

  async unlock(): Promise<void> {
    const context = this.context;
    if (typeof AudioContext !== 'undefined' && context instanceof AudioContext) {
      if (context.state !== 'running') await context.resume();
      // Un tampon silencieux finit de débloquer la sortie sur certains navigateurs mobiles.
      const silence = context.createBufferSource();
      silence.buffer = context.createBuffer(1, 1, context.sampleRate);
      silence.connect(context.destination);
      silence.start();
    }
  }

  isLoaded(instrument: InstrumentId): boolean {
    return instrument !== 'piano' || this.#piano.size === PIANO_SAMPLES.length;
  }

  load(instrument: InstrumentId, onProgress?: (ratio: number) => void): Promise<void> {
    if (this.isLoaded(instrument)) {
      onProgress?.(1);
      return Promise.resolve();
    }
    this.#pianoLoading ??= this.#loadPiano(onProgress).catch((error: unknown) => {
      this.#pianoLoading = null; // un nouvel essai reste possible
      throw error;
    });
    return this.#pianoLoading;
  }

  async #loadPiano(onProgress?: (ratio: number) => void): Promise<void> {
    let loaded = 0;
    await Promise.all(
      PIANO_SAMPLES.map(async ({ name, midi }) => {
        const response = await this.#fetch(sampleUrl(this.#baseUrl, name));
        if (!response.ok) throw new Error(`Échantillon ${name} introuvable (${response.status})`);
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.#piano.set(midi, buffer);
        loaded += 1;
        onProgress?.(loaded / PIANO_SAMPLES.length);
      }),
    );
  }

  play(notes: readonly NoteEvent[], options: PlayOptions = {}): PlaybackHandle {
    this.stopAll();
    const startTime = this.context.currentTime + LOOKAHEAD;
    const voices = notes.map((note) => {
      const instrument = note.instrument ?? options.instrument ?? 'piano';
      const voice =
        instrument === 'drone'
          ? this.#droneVoice(note, startTime)
          : instrument === 'piano' && this.isLoaded('piano')
            ? this.#pianoVoice(note, startTime)
            : this.#pureVoice(note, startTime);
      this.#voices.add(voice);
      return voice;
    });

    const finished = new Promise<void>((resolve) => {
      let remaining = voices.length;
      if (remaining === 0) resolve();
      for (const voice of voices) {
        voice.source.onended = () => {
          this.#voices.delete(voice);
          remaining -= 1;
          if (remaining === 0) resolve();
        };
      }
    });

    const end = voices.reduce((latest, voice) => Math.max(latest, voice.end), startTime);
    const lastNoteEnd = notes.reduce(
      (latest, note) => Math.max(latest, note.start + note.duration),
      0,
    );
    const untilStart = startTime - this.context.currentTime;
    return {
      startTime,
      duration: end - startTime,
      notesEndAt: performance.now() + (untilStart + lastNoteEnd + this.#outputLatency()) * 1000,
      finished,
      stop: () => voices.forEach((voice) => this.#fadeOut(voice)),
    };
  }

  stopAll(): void {
    this.#voices.forEach((voice) => this.#fadeOut(voice));
  }

  setVolume(volume: number): void {
    this.#volume = Math.min(1, Math.max(0, volume));
    this.#output?.gain.setTargetAtTime(this.#volume, this.context.currentTime, 0.02);
  }

  /** Chaîne de sortie : volume général puis compresseur-limiteur, contre la saturation des accords. */
  get #outputNode(): GainNode {
    if (!this.#output) {
      const context = this.context;
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.2;
      const master = context.createGain();
      master.gain.value = this.#volume;
      master.connect(limiter).connect(context.destination);
      this.#output = master;
    }
    return this.#output;
  }

  #pianoVoice(note: NoteEvent, startTime: number): Voice {
    const context = this.context;
    const { sample, playbackRate } = nearestSample(note.midi);
    const source = context.createBufferSource();
    source.buffer = this.#piano.get(sample.midi) ?? null;
    source.playbackRate.value = playbackRate;
    return this.#schedule(source, note, startTime, note.velocity * PIANO_GAIN, null);
  }

  #pureVoice(note: NoteEvent, startTime: number): Voice {
    const context = this.context;
    // Son presque pur : la fondamentale et deux harmoniques discrets, pour rester
    // audible dans le grave sur un haut-parleur de téléphone.
    this.#pureWave ??= context.createPeriodicWave(
      new Float32Array([0, 1, 0.2, 0.05]),
      new Float32Array([0, 0, 0, 0]),
    );
    const oscillator = context.createOscillator();
    oscillator.setPeriodicWave(this.#pureWave);
    oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);
    return this.#schedule(oscillator, note, startTime, note.velocity * PURE_GAIN, 0.6);
  }

  /**
   * Son tenu du bourdon (§6.5) : une onde riche en harmoniques adoucie par un filtre
   * passe-bas, qui entre et sort lentement. Le piano s'éteindrait trop vite.
   */
  #droneVoice(note: NoteEvent, startTime: number): Voice {
    const context = this.context;
    this.#droneWave ??= context.createPeriodicWave(
      new Float32Array([0, 1, 0.55, 0.35, 0.22, 0.12, 0.08, 0.05]),
      new Float32Array(8),
    );
    const oscillator = context.createOscillator();
    oscillator.setPeriodicWave(this.#droneWave);
    oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.4;
    const gain = context.createGain();
    const peak = note.velocity * DRONE_GAIN;
    const start = startTime + note.start;
    const release = start + Math.max(note.duration, DRONE_ATTACK);
    const end = release + DRONE_RELEASE;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + DRONE_ATTACK);
    gain.gain.setValueAtTime(peak, release);
    gain.gain.setTargetAtTime(0, release, DRONE_RELEASE / 4);
    oscillator.connect(filter).connect(gain).connect(this.#outputNode);
    oscillator.start(start);
    oscillator.stop(end);
    return { source: oscillator, gain, end };
  }

  /**
   * Enveloppe commune : attaque courte, éventuelle décroissance vers un palier
   * (`sustain`, en proportion du pic ; null pour laisser l'échantillon décroître
   * naturellement), puis relâchement à la fin de la note.
   */
  #schedule(
    source: AudioScheduledSourceNode,
    note: NoteEvent,
    startTime: number,
    peak: number,
    sustain: number | null,
  ): Voice {
    const gain = this.context.createGain();
    const start = startTime + note.start;
    const release = start + Math.max(note.duration, ATTACK);
    const end = release + RELEASE;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + ATTACK);
    if (sustain !== null) gain.gain.setTargetAtTime(peak * sustain, start + ATTACK, 0.3);
    gain.gain.setTargetAtTime(0, release, RELEASE / 4);
    source.connect(gain).connect(this.#outputNode);
    source.start(start);
    source.stop(end);
    return { source, gain, end };
  }

  #fadeOut(voice: Voice): void {
    const now = this.context.currentTime;
    const param = voice.gain.gain;
    if (typeof param.cancelAndHoldAtTime === 'function') {
      param.cancelAndHoldAtTime(now);
    } else {
      const current = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
    param.linearRampToValueAtTime(0, now + FADE_OUT);
    try {
      voice.source.stop(now + FADE_OUT + 0.01);
    } catch {
      // Déjà arrêtée.
    }
  }
}
