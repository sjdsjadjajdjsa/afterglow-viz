import { hashString } from "../../src/util/math";
import { mockAnalysis, mockFeatures, type MockAudioSpec } from "./analysis";

export interface MockTrack {
  uri: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  tempo: number;
  energy: number;
  art: string | null;
}

export type DataShape = "current" | "legacy" | "sparse";
export type AudioMode = "available" | "failing" | "missing";

export interface MockSnapshot {
  index: number;
  track: MockTrack;
  playing: boolean;
  positionMs: number;
  shape: DataShape;
  audio: AudioMode;
}

type Listener = (event: { type: string; data: unknown }) => void;

interface Options {
  tracks: MockTrack[];
  extras?: Record<string, unknown>;
  progressEveryMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => () => void;
}

const LATENCY_MS = 120;

// fake Player, getAudioData and CosmosAsync. onprogress sends the position in ms like the real one
export function createMockSpicetify({
  tracks,
  extras = {},
  progressEveryMs = 250,
  now = () => performance.now(),
  setTimer = (fn, ms) => {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
}: Options) {
  const listeners = new Map<string, Set<Listener>>();
  const watchers = new Set<() => void>();
  let index = 0;
  let playing = false;
  let anchorPos = 0;
  let anchorAt = now();
  let shape: DataShape = "current";
  let audio: AudioMode = "available";
  let stopTimer: (() => void) | null = null;

  const track = () => tracks[index];
  const position = () => Math.min(track().durationMs, anchorPos + (playing ? now() - anchorAt : 0));
  const anchor = (pos: number) => {
    anchorPos = Math.max(0, Math.min(pos, track().durationMs));
    anchorAt = now();
  };
  const emit = (type: string, data: unknown) => {
    listeners.get(type)?.forEach((fn) => fn({ type, data }));
    watchers.forEach((fn) => fn());
  };

  const tick = () => {
    if (position() >= track().durationMs) {
      go(index + 1);
      return;
    }
    emit("onprogress", Math.round(position()));
  };
  const setPlaying = (next: boolean) => {
    if (next === playing) return;
    anchor(position());
    playing = next;
    stopTimer?.();
    stopTimer = playing ? setTimer(tick, progressEveryMs) : null;
    emit("onplaypause", buildData());
  };
  const go = (next: number) => {
    index = (next + tracks.length) % tracks.length;
    anchor(0);
    emit("songchange", buildData());
  };

  function buildData(): unknown {
    const t = track();
    const pos = Math.round(position());
    const images = t.art ? { image_url: t.art, image_large_url: t.art, image_xlarge_url: t.art } : {};
    if (shape === "legacy") {
      return {
        track: {
          uri: t.uri,
          metadata: { title: t.title, artist_name: t.artist, album_title: t.album, duration: String(t.durationMs), ...images },
        },
        is_paused: !playing,
        duration: t.durationMs,
        position: pos,
        timestamp: Date.now(),
      };
    }
    if (shape === "sparse") {
      return {
        item: {
          uri: t.uri,
          name: t.title,
          artists: [{ name: t.artist }],
          album: { name: t.album, images: t.art ? [{ url: t.art, width: 640 }] : [] },
          duration: { milliseconds: t.durationMs },
        },
        isPlaying: playing,
      };
    }
    return {
      item: {
        uri: t.uri,
        type: "track",
        name: t.title,
        metadata: { title: t.title, artist_name: t.artist, album_title: t.album, duration: String(t.durationMs), ...images },
        artists: [{ name: t.artist, uri: "spotify:artist:mock" }],
        album: { name: t.album, uri: "spotify:album:mock", images: t.art ? [{ url: t.art, label: "large" }] : [] },
        duration: { milliseconds: t.durationMs },
      },
      isPaused: !playing,
      isBuffering: false,
      duration: t.durationMs,
      positionAsOfTimestamp: pos,
      timestamp: Date.now(),
      context: { uri: "spotify:playlist:mock" },
      sessionId: "mock-session",
    };
  }

  const specFor = (id: string): MockAudioSpec | null => {
    const t = tracks.find((x) => x.uri === `spotify:track:${id}`);
    return t ? { seed: hashString(t.uri), durationMs: t.durationMs, tempo: t.tempo, energy: t.energy } : null;
  };
  const later = <T>(fn: () => T) => new Promise<T>((resolve, reject) => setTimeout(() => {
    try {
      resolve(fn());
    } catch (error) {
      reject(error);
    }
  }, LATENCY_MS));

  // like the real one, rejects non-track uris with a plain string
  const getAudioData = (uri?: string) =>
    later(() => {
      const id = /^spotify:track:(.+)$/.exec(uri ?? track().uri)?.[1];
      if (!id) throw "URI is invalid.";
      if (audio === "failing") throw new Error("Request failed with status 403 (mock)");
      const spec = specFor(id);
      if (!spec) throw new Error("Request failed with status 404 (mock)");
      return mockAnalysis(spec);
    });

  const cosmosGet = (url: string) =>
    later(() => {
      if (audio === "failing") throw { code: 403, message: "Forbidden (mock)" };
      const match = /\/(audio-analysis|audio-features)\/([^/?]+)/.exec(url);
      const spec = match && specFor(match[2]);
      if (!match || !spec) throw { code: 404, message: "Not found (mock)" };
      return match[1] === "audio-analysis" ? mockAnalysis(spec) : mockFeatures(match[2], spec);
    });

  const Player = {
    get data() {
      return buildData();
    },
    addEventListener(type: string, fn: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.get(type)?.delete(fn);
    },
    getProgress: () => Math.round(position()),
    getDuration: () => track().durationMs,
    isPlaying: () => playing,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    togglePlay: () => setPlaying(!playing),
    next: () => go(index + 1),
    back: () => (position() > 3000 ? Player.seek(0) : go(index - 1)),
    seek(pos: number) {
      anchor(pos > 0 && pos <= 1 ? pos * track().durationMs : pos);
      emit("onprogress", Math.round(position()));
    },
  };

  const Spicetify = {
    ...extras,
    Config: { version: "harness" },
    Platform: { version: "harness" },
    Player,
    get getAudioData() {
      return audio === "missing" ? undefined : getAudioData;
    },
    get CosmosAsync() {
      return audio === "missing" ? undefined : { get: cosmosGet };
    },
  };

  const controls = {
    snapshot: (): MockSnapshot => ({ index, track: track(), playing, positionMs: position(), shape, audio }),
    subscribe(fn: () => void): () => void {
      watchers.add(fn);
      return () => watchers.delete(fn);
    },
    select: go,
    setShape(next: DataShape) {
      shape = next;
      // fire songchange so the app picks up the new shape
      emit("songchange", buildData());
    },
    setAudio(next: AudioMode) {
      audio = next;
      watchers.forEach((fn) => fn());
    },
  };

  return { Spicetify, controls };
}
