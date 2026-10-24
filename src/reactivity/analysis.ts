import { clamp01, smoothstep } from "../util/math";
import { asObj, num } from "../util/read";
import { SynthSource } from "./synth";
import { BAND_COUNT, type ReactiveFrame, type ReactivitySource, type TrackContext } from "./types";

interface Segment {
  start: number;
  duration: number;
  loudStart: number;
  loudMax: number;
  loudMaxTime: number;
  pitches: number[];
  bright: number;
}

interface Beat {
  start: number;
  duration: number;
  confidence: number;
}

export interface Analysis {
  tempo: number;
  segments: Segment[];
  beats: Beat[];
  // how much to trust the beat grid, 0..1
  gridTrust: number;
  quiet: number;
  loud: number;
  dim: number;
  bright: number;
}

const RETRY_MS = 60_000;
const CACHE_SIZE = 30;

// spotify's audio-analysis response, times in seconds, loudness in dB
export function parseAnalysis(raw: unknown): Analysis | null {
  const o = asObj(raw);
  const segments: Segment[] = [];
  for (const s of Array.isArray(o.segments) ? o.segments : []) {
    const seg = asObj(s);
    const start = num(seg.start);
    const duration = num(seg.duration);
    const loudMax = num(seg.loudness_max);
    if (start === null || duration === null || loudMax === null) continue;
    const pitches = Array.isArray(seg.pitches) ? seg.pitches.map((p) => clamp01(num(p) ?? 0)) : [];
    const timbre = Array.isArray(seg.timbre) ? seg.timbre : [];
    segments.push({
      start,
      duration: Math.max(duration, 0.001),
      loudStart: num(seg.loudness_start) ?? loudMax,
      loudMax,
      loudMaxTime: Math.min(Math.max(num(seg.loudness_max_time) ?? 0, 0), duration),
      pitches: pitches.length === 12 ? pitches : new Array(12).fill(0.5),
      bright: num(timbre[1]) ?? 0,
    });
  }
  const beats: Beat[] = [];
  for (const b of Array.isArray(o.beats) ? o.beats : []) {
    const beat = asObj(b);
    const start = num(beat.start);
    const duration = num(beat.duration);
    if (start === null || duration === null || duration <= 0) continue;
    beats.push({ start, duration, confidence: clamp01(num(beat.confidence) ?? 0.5) });
  }
  if (!segments.length) return null;
  segments.sort((a, b) => a.start - b.start);
  beats.sort((a, b) => a.start - b.start);

  const track = asObj(o.track);
  const avgBeatConfidence = beats.length ? beats.reduce((n, b) => n + b.confidence, 0) / beats.length : 0;
  const louds = segments.map((s) => s.loudMax);
  const brights = segments.map((s) => s.bright);
  return {
    tempo: num(track.tempo) ?? 0,
    segments,
    beats,
    gridTrust: beats.length ? clamp01(Math.max(num(track.tempo_confidence) ?? 0, avgBeatConfidence)) : 0,
    quiet: percentile(louds, 0.1),
    loud: Math.max(percentile(louds, 0.95), percentile(louds, 0.1) + 6),
    dim: percentile(brights, 0.05),
    bright: Math.max(percentile(brights, 0.95), percentile(brights, 0.05) + 1),
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

// last item whose start is <= t, or -1
function findAt<T extends { start: number }>(items: T[], t: number): number {
  let lo = 0;
  let hi = items.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].start <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function sampleAnalysis(a: Analysis, positionMs: number, out: ReactiveFrame): void {
  const t = positionMs / 1000;
  const i = findAt(a.segments, t);
  if (i < 0) {
    out.level = out.beat = 0;
    out.beatPhase = 0;
    out.bands.fill(0);
    return;
  }
  const seg = a.segments[i];
  const next = a.segments[i + 1];
  const into = t - seg.start;
  const after = Math.max(0, seg.duration - seg.loudMaxTime);
  const db =
    into < seg.loudMaxTime
      ? lerp(seg.loudStart, seg.loudMax, into / Math.max(seg.loudMaxTime, 0.001))
      : lerp(seg.loudMax, next ? next.loudStart : seg.loudMax - 20, Math.min(1, (into - seg.loudMaxTime) / Math.max(after, 0.001)));
  const level = clamp01((db - a.quiet) / (a.loud - a.quiet)) * 0.85 + 0.15 * smoothstep(-60, a.quiet, db);

  const onset = clamp01((seg.loudMax - seg.loudStart) / 18) * Math.exp(-into / 0.12);
  const b = findAt(a.beats, t);
  let grid = 0;
  let phase = 0;
  if (b >= 0 && t < a.beats[b].start + a.beats[b].duration * 1.5) {
    const beat = a.beats[b];
    phase = Math.min(0.999, (t - beat.start) / beat.duration);
    grid = Math.exp(-phase * 6) * (0.5 + 0.5 * beat.confidence);
  }
  out.level = level;
  out.beat = clamp01(Math.max(grid * a.gridTrust, onset * (1 - 0.5 * a.gridTrust)) * (0.4 + 0.6 * level));
  out.beatPhase = phase;

  const tilt = clamp01((seg.bright - a.dim) / (a.bright - a.dim));
  for (let k = 0; k < BAND_COUNT; k++) {
    const x = k / (BAND_COUNT - 1);
    const p = x * 11;
    const lo = Math.floor(p);
    const chroma = lerp(seg.pitches[lo], seg.pitches[Math.min(11, lo + 1)], p - lo);
    const shape = 1 - (1 - tilt) * 0.7 * x;
    const kick = out.beat * Math.max(0, 1 - x * 4) * 0.35;
    out.bands[k] = clamp01(level * (0.55 * shape + 0.45 * chroma * shape) + kick);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

type Fetcher = (uri: string) => Promise<unknown>;

// real loudness, pitch and beats from spotify's analysis. synth while loading,
// and for ads, podcasts, local files and failed requests
export class AnalysisSource implements ReactivitySource {
  private current: Analysis | null = null;
  private uri: string | null = null;
  private status: "idle" | "loading" | "missing" = "idle";
  private readonly cache = new Map<string, Analysis>();
  private readonly failedAt = new Map<string, number>();

  constructor(
    private readonly fetch: Fetcher | undefined,
    private readonly fallback: ReactivitySource = new SynthSource(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  get kind(): string {
    return this.current ? "analysis" : this.status === "loading" ? "synth (loading analysis)" : "synth";
  }

  setTrack(track: TrackContext | null): void {
    this.fallback.setTrack(track);
    const uri = track?.uri ?? null;
    this.uri = uri;
    this.current = null;
    this.status = "missing";
    if (!uri || !uri.startsWith("spotify:track:") || !this.fetch) return;

    const cached = this.cache.get(uri);
    if (cached) {
      this.current = cached;
      return;
    }
    const failed = this.failedAt.get(uri);
    if (failed !== undefined && this.now() - failed < RETRY_MS) return;

    this.status = "loading";
    Promise.resolve()
      .then(() => this.fetch!(uri))
      .then(parseAnalysis)
      .catch(() => null)
      .then((analysis) => {
        if (analysis) this.remember(uri, analysis);
        else this.failedAt.set(uri, this.now());
        if (this.uri !== uri) return;
        this.current = analysis;
        this.status = analysis ? "idle" : "missing";
      });
  }

  sample(positionMs: number, out: ReactiveFrame): void {
    if (this.current) sampleAnalysis(this.current, positionMs, out);
    else this.fallback.sample(positionMs, out);
  }

  private remember(uri: string, analysis: Analysis): void {
    this.cache.delete(uri);
    this.cache.set(uri, analysis);
    if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
  }
}
