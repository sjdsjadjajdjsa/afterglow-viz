import { clamp01, hashString, seededRandom, smoothstep } from "../util/math";
import { BAND_COUNT, type ReactiveFrame, type ReactivitySource, type TrackContext } from "./types";

export const DEFAULT_ENERGY = 0.6;
const TWO_PI = Math.PI * 2;

// fallback when there's no audio data. everything comes from position, tempo
// (guessed if missing) and a seed from the track uri
export class SynthSource implements ReactivitySource {
  readonly kind = "synth";
  private beatMs = 500;
  private energy = DEFAULT_ENERGY;
  private durationMs = 0;
  private phraseOffset = 0;
  private readonly rate = new Float32Array(BAND_COUNT);
  private readonly offset = new Float32Array(BAND_COUNT);

  constructor() {
    this.setTrack(null);
  }

  setTrack(track: TrackContext | null): void {
    const rand = seededRandom(hashString(track?.uri ?? track?.id ?? ""));
    const guessedTempo = 96 + rand() * 32;
    this.beatMs = 60_000 / foldTempo(track?.tempo && track.tempo > 0 ? track.tempo : guessedTempo);
    this.energy = clamp01(track?.energy ?? DEFAULT_ENERGY);
    this.durationMs = Math.max(0, track?.durationMs ?? 0);
    this.phraseOffset = rand() * TWO_PI;
    for (let i = 0; i < BAND_COUNT; i++) {
      const x = i / (BAND_COUNT - 1);
      // cycles per beat
      this.rate[i] = 0.05 + rand() * 0.25 * (0.6 + x);
      this.offset[i] = rand() * TWO_PI;
    }
  }

  sample(positionMs: number, out: ReactiveFrame): void {
    const pos = Math.max(0, positionMs);
    const beats = pos / this.beatMs;
    const index = Math.floor(beats);
    const phase = beats - index;

    const kick = (index % 4 === 0 ? 1 : 0.7) * Math.exp(-phase * 6);
    const offbeat = Math.exp(-((phase - 0.5) ** 2) * 60);
    const phrase = 0.5 + 0.5 * Math.sin((beats / 32) * TWO_PI + this.phraseOffset);
    const fadeOut = this.durationMs > 0 ? smoothstep(0, 4000, this.durationMs - pos) : 1;
    const fade = smoothstep(0, 2500, pos) * fadeOut;
    const drive = (0.35 + 0.65 * this.energy) * fade;

    out.level = clamp01(drive * (0.4 + 0.3 * phrase + 0.3 * kick));
    out.beat = clamp01(kick * fade);
    out.beatPhase = phase;
    for (let i = 0; i < BAND_COUNT; i++) {
      const x = i / (BAND_COUNT - 1);
      const wobble = 0.5 + 0.5 * Math.sin(beats * this.rate[i] * TWO_PI + this.offset[i]);
      const body = (1 - 0.5 * x) * (0.2 + 0.5 * wobble * (0.6 + 0.4 * phrase));
      const low = 0.6 * kick * Math.max(0, 1 - x * 3.5);
      const high = 0.5 * offbeat * smoothstep(0.55, 1, x);
      out.bands[i] = clamp01((body + low + high) * drive);
    }
  }
}

export function foldTempo(bpm: number): number {
  let t = bpm;
  while (t > 160) t /= 2;
  while (t < 70) t *= 2;
  return t;
}
