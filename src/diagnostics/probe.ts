import { readNowPlaying, type NowPlaying } from "../player/nowPlaying";
import type { PlayerEventName, PlayerLike, PlayerListener, SpicetifyLike } from "../spicetify";
import { asObj, attempt, isObj, num, str } from "../util/read";
import { describeShape } from "./shape";

export type Status = "ok" | "missing" | "failed" | "waiting";

export interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
  ms?: number;
  data?: unknown;
}

export interface ProbeResult {
  at: string;
  environment: Record<string, string | null>;
  nowPlaying: NowPlaying | null;
  playerData: unknown;
  checks: Check[];
}

const REQUIRED_PLAYER_API = ["addEventListener", "removeEventListener", "getProgress", "isPlaying"] as const;
const OPTIONAL_PLAYER_API = ["getDuration", "togglePlay", "next", "back", "seek"] as const;
const TIMEOUT_MS = 10_000;

export const analysisUrl = (id: string) =>
  `https://spclient.wg.spotify.com/audio-attributes/v1/audio-analysis/${id}?format=json`;
export const featuresUrl = (id: string) => `https://api.spotify.com/v1/audio-features/${id}`;

export async function probe(S: SpicetifyLike | undefined): Promise<ProbeResult> {
  const player = S?.Player;
  const data = attempt(() => player?.data, undefined);
  const nowPlaying = readNowPlaying(data);
  const trackId = nowPlaying?.kind === "track" ? nowPlaying.id : null;
  const cosmosGet = S?.CosmosAsync?.get?.bind(S.CosmosAsync);
  const getAudioData = S?.getAudioData?.bind(S);

  const checks: Check[] = [
    checkSpicetify(S),
    checkPlayerApi(player),
    checkPlayerData(data, nowPlaying),
    ...(await Promise.all([
      timed("getAudioData", "Spicetify.getAudioData()", trackId, getAudioData && ((id) => getAudioData(`spotify:track:${id}`)), summarizeAnalysis),
      timed("analysis-endpoint", "Audio analysis endpoint", trackId, cosmosGet && ((id) => cosmosGet(analysisUrl(id))), summarizeAnalysis),
      timed("audio-features", "Audio features endpoint", trackId, cosmosGet && ((id) => cosmosGet(featuresUrl(id))), summarizeFeatures),
    ])),
    checkCaptureApis(),
  ];

  return {
    at: new Date().toISOString(),
    environment: readEnvironment(S),
    nowPlaying,
    playerData: describeShape(data, 3),
    checks,
  };
}

function checkSpicetify(S: SpicetifyLike | undefined): Check {
  if (!S) return { id: "spicetify", label: "Spicetify", status: "missing", detail: "No Spicetify global" };
  return { id: "spicetify", label: "Spicetify", status: "ok", detail: str(S.Config?.version) ?? "version unknown" };
}

function checkPlayerApi(player: PlayerLike | undefined): Check {
  const label = "Player API";
  if (!player) return { id: "player-api", label, status: "missing", detail: "No Spicetify.Player" };
  const has = (name: string) => typeof (player as Record<string, unknown>)[name] === "function";
  const missingRequired = REQUIRED_PLAYER_API.filter((name) => !has(name));
  const missingOptional = OPTIONAL_PLAYER_API.filter((name) => !has(name));
  const missing = [...missingRequired, ...missingOptional];
  return {
    id: "player-api",
    label,
    status: missingRequired.length ? "failed" : "ok",
    detail: missing.length ? `Missing: ${missing.join(", ")}` : "Everything the app uses is there",
  };
}

function checkPlayerData(data: unknown, np: NowPlaying | null): Check {
  const label = "Player.data";
  if (data == null) return { id: "player-data", label, status: "waiting", detail: "Nothing playing yet" };
  if (!np) return { id: "player-data", label, status: "failed", detail: "Couldn't find a track in it. The shape is in the report." };
  const gaps = [
    !np.uri && "uri",
    !np.title && "title",
    !np.artist && "artist",
    !np.imageUrl && "image",
    !np.durationMs && "duration",
    np.isPaused === null && "paused state",
  ].filter(Boolean);
  const what = `"${np.title || "?"}" by ${np.artist || "?"} (${np.kind})`;
  return {
    id: "player-data",
    label,
    status: np.uri && np.title ? "ok" : "failed",
    detail: gaps.length ? `${what}, no ${gaps.join(", ")}` : what,
  };
}

interface Summary {
  usable: boolean;
  summary: string;
  data: unknown;
}

async function timed(
  id: string,
  label: string,
  trackId: string | null,
  fetcher: ((trackId: string) => Promise<unknown>) | undefined,
  summarize: (value: unknown) => Summary,
): Promise<Check> {
  if (!fetcher) return { id, label, status: "missing", detail: "Not available in this Spicetify" };
  if (!trackId) return { id, label, status: "waiting", detail: "Play a Spotify track (not a podcast or local file)" };
  const started = performance.now();
  try {
    const value = await withTimeout(Promise.resolve().then(() => fetcher(trackId)), TIMEOUT_MS);
    const ms = Math.round(performance.now() - started);
    const s = summarize(value);
    return { id, label, status: s.usable ? "ok" : "failed", detail: s.summary, ms, data: s.data };
  } catch (error) {
    return { id, label, status: "failed", detail: errorMessage(error), ms: Math.round(performance.now() - started) };
  }
}

export function summarizeAnalysis(value: unknown): Summary {
  const o = asObj(value);
  const track = asObj(o.track);
  const count = (key: string) => (Array.isArray(o[key]) ? (o[key] as unknown[]).length : 0);
  const segments = Array.isArray(o.segments) ? o.segments : [];
  const first = asObj(segments[0]);
  const counts = {
    sections: count("sections"),
    segments: count("segments"),
    beats: count("beats"),
    bars: count("bars"),
    tatums: count("tatums"),
  };
  const tempo = num(track.tempo);
  const usable = counts.segments > 0 && counts.beats > 0;
  return {
    usable,
    summary: usable
      ? `tempo ${tempo?.toFixed(1) ?? "?"}, ${counts.segments} segments, ${counts.beats} beats, ${counts.sections} sections`
      : "Responded, but with no segments or beats",
    data: {
      track: { tempo, loudness: num(track.loudness), duration: num(track.duration), time_signature: num(track.time_signature) },
      counts,
      pitches: Array.isArray(first.pitches) ? first.pitches.length : null,
      timbre: Array.isArray(first.timbre) ? first.timbre.length : null,
      shape: describeShape(value, 2),
    },
  };
}

export function summarizeFeatures(value: unknown): Summary {
  const o = asObj(value);
  const f = Array.isArray(o.audio_features) ? asObj(o.audio_features[0]) : o;
  const fields = ["tempo", "energy", "loudness", "danceability", "valence"] as const;
  const values = Object.fromEntries(fields.map((k) => [k, num(f[k])]));
  const usable = values.tempo !== null || values.energy !== null;
  const shown = fields.filter((k) => values[k] !== null).map((k) => `${k} ${round(values[k]!)}`);
  return {
    usable,
    summary: usable ? shown.join(", ") : "Responded, but with no tempo or energy",
    data: { ...values, shape: describeShape(value, 2) },
  };
}

function checkCaptureApis(): Check {
  const g = globalThis as { AudioContext?: unknown; navigator?: Navigator };
  const media = g.navigator?.mediaDevices;
  const flags = {
    AudioContext: typeof g.AudioContext === "function",
    getUserMedia: typeof media?.getUserMedia === "function",
    getDisplayMedia: typeof media?.getDisplayMedia === "function",
  };
  const detail = Object.entries(flags)
    .map(([name, ok]) => `${name} ${ok ? "yes" : "no"}`)
    .join(", ");
  return {
    id: "capture-apis",
    label: "Live capture APIs",
    status: flags.AudioContext && flags.getDisplayMedia ? "ok" : "missing",
    detail,
    data: flags,
  };
}

// can pop a screen share prompt, so only run it on click
export async function testCapture(): Promise<Check> {
  const id = "capture-test";
  const label = "Live capture test";
  const media = (globalThis as { navigator?: Navigator }).navigator?.mediaDevices;
  if (typeof media?.getDisplayMedia !== "function") {
    return { id, label, status: "missing", detail: "getDisplayMedia isn't available here" };
  }
  let stream: MediaStream | undefined;
  const started = performance.now();
  try {
    stream = await withTimeout(media.getDisplayMedia({ audio: true, video: true }), 60_000);
    const audio = stream.getAudioTracks();
    if (!audio.length) return { id, label, status: "failed", detail: "Got a capture without an audio track" };
    const peak = await measurePeak(stream, 1500);
    return {
      id,
      label,
      status: peak > 0.001 ? "ok" : "failed",
      detail: `Audio track "${audio[0].label || "unnamed"}", peak ${peak.toFixed(3)}${peak > 0.001 ? "" : " (silent, was music playing?)"}`,
      ms: Math.round(performance.now() - started),
    };
  } catch (error) {
    return { id, label, status: "failed", detail: errorMessage(error), ms: Math.round(performance.now() - started) };
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

async function measurePeak(stream: MediaStream, ms: number): Promise<number> {
  const ctx = new AudioContext();
  try {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    let peak = 0;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      analyser.getFloatTimeDomainData(buffer);
      for (const v of buffer) peak = Math.max(peak, Math.abs(v));
    }
    return peak;
  } finally {
    await ctx.close();
  }
}

function readEnvironment(S: SpicetifyLike | undefined): Record<string, string | null> {
  const ua = (globalThis as { navigator?: Navigator }).navigator?.userAgent ?? null;
  return {
    spicetify: str(S?.Config?.version),
    spotify: str(S?.Platform?.version) ?? ua?.match(/Spotify\/([\d.]+)/)?.[1] ?? null,
    react: str(S?.React?.version),
    userAgent: ua,
  };
}

export interface EventStats {
  count: number;
  everyMs: number | null;
  lastPayload: unknown;
}

export class EventLog {
  private readonly stats = new Map<PlayerEventName, { count: number; first: number; last: number; payload: unknown }>();
  private readonly handlers: [PlayerEventName, PlayerListener][];

  constructor(
    private readonly player: PlayerLike | undefined,
    private readonly now: () => number = () => performance.now(),
  ) {
    const names: PlayerEventName[] = ["songchange", "onplaypause", "onprogress"];
    this.handlers = names.map((name): [PlayerEventName, PlayerListener] => [name, (event) => this.record(name, event?.data)]);
  }

  start(): void {
    for (const [type, fn] of this.handlers) attempt(() => this.player?.addEventListener?.(type, fn), undefined);
  }

  stop(): void {
    for (const [type, fn] of this.handlers) attempt(() => this.player?.removeEventListener?.(type, fn), undefined);
  }

  snapshot(): Record<PlayerEventName, EventStats> {
    const out = {} as Record<PlayerEventName, EventStats>;
    for (const [name] of this.handlers) {
      const s = this.stats.get(name);
      out[name] = {
        count: s?.count ?? 0,
        everyMs: s && s.count > 1 ? Math.round((s.last - s.first) / (s.count - 1)) : null,
        lastPayload: s?.payload ?? null,
      };
    }
    return out;
  }

  private record(name: PlayerEventName, payload: unknown): void {
    const at = this.now();
    const s = this.stats.get(name) ?? { count: 0, first: at, last: at, payload: null };
    s.count++;
    s.last = at;
    s.payload = name === "onprogress" && typeof payload === "number" ? payload : describeShape(payload, 2);
    this.stats.set(name, s);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.name && error.name !== "Error" ? `${error.name}: ${error.message}` : error.message;
  if (typeof error === "string") return error;
  if (isObj(error)) {
    const code = num(error.code) ?? num(error.status);
    const message = str(error.message, error.error, asObj(error.error).message);
    if (code !== null || message) return [code, message].filter((x) => x !== null).join(" ");
    return JSON.stringify(describeShape(error, 1));
  }
  return String(error);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No answer after ${ms / 1000} s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
