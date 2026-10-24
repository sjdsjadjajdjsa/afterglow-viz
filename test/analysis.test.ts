import { describe, expect, it } from "vitest";
import { mockAnalysis } from "../dev/mock/analysis";
import { AnalysisSource, parseAnalysis, sampleAnalysis } from "../src/reactivity/analysis";
import { createFrame, type ReactiveFrame, type ReactivitySource, type TrackContext } from "../src/reactivity/types";

const raw = mockAnalysis({ seed: 7, durationMs: 120_000, tempo: 120, energy: 0.7 });
const track = (uri: string): TrackContext => ({ uri, id: uri.split(":")[2] ?? null, durationMs: 120_000 });
const flush = () => new Promise((r) => setTimeout(r, 0));

class Fallback implements ReactivitySource {
  readonly kind = "fallback";
  setTrack() {}
  sample(_: number, out: ReactiveFrame) {
    out.level = 0.123;
  }
}

describe("parseAnalysis", () => {
  it("reads segments and beats", () => {
    const a = parseAnalysis(raw)!;
    expect(a.segments.length).toBe(raw.segments.length);
    expect(a.beats.length).toBe(raw.beats.length);
    expect(a.tempo).toBe(120);
    expect(a.loud).toBeGreaterThan(a.quiet);
  });

  it("returns null for junk", () => {
    for (const input of [null, {}, { segments: "x" }, { segments: [{ start: "a" }] }]) {
      expect(parseAnalysis(input)).toBeNull();
    }
  });

  it("skips broken segments and pads missing pitches", () => {
    const a = parseAnalysis({ segments: [{ start: 0, duration: 1, loudness_max: -10 }, { nope: 1 }], beats: [] })!;
    expect(a.segments).toHaveLength(1);
    expect(a.segments[0].pitches).toHaveLength(12);
    expect(a.gridTrust).toBe(0);
  });
});

describe("sampleAnalysis", () => {
  const a = parseAnalysis(raw)!;

  it("keeps everything in 0..1", () => {
    const f = createFrame();
    for (let t = -500; t < 125_000; t += 97) {
      sampleAnalysis(a, t, f);
      for (const v of [f.level, f.beat, f.beatPhase, ...f.bands]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("follows the beat grid", () => {
    const f = createFrame();
    const beat = raw.beats[40];
    sampleAnalysis(a, beat.start * 1000 + 5, f);
    const onBeat = f.beat;
    expect(f.beatPhase).toBeLessThan(0.05);
    sampleAnalysis(a, (beat.start + beat.duration * 0.8) * 1000, f);
    expect(f.beatPhase).toBeCloseTo(0.8, 1);
    expect(f.beat).toBeLessThan(onBeat);
  });

  it("stays finite when silent segments set the quiet floor", () => {
    const segments = Array.from({ length: 20 }, (_, i) => ({
      start: i,
      duration: 1,
      loudness_start: i < 3 ? -60 : -20,
      loudness_max: i < 3 ? -60 : -8,
      loudness_max_time: 0.1,
      pitches: new Array(12).fill(0.5),
      timbre: new Array(12).fill(0),
    }));
    const silent = parseAnalysis({ segments, beats: [] })!;
    expect(silent.quiet).toBe(-60);
    const f = createFrame();
    for (let t = 0; t < 20_000; t += 50) {
      sampleAnalysis(silent, t, f);
      for (const v of [f.level, f.beat, ...f.bands]) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("changes with the music", () => {
    const f = createFrame();
    const levels = new Set<number>();
    for (let t = 10_000; t < 20_000; t += 250) {
      sampleAnalysis(a, t, f);
      levels.add(Math.round(f.level * 100));
    }
    expect(levels.size).toBeGreaterThan(5);
  });
});

describe("AnalysisSource", () => {
  it("uses the fallback while loading, then the analysis", async () => {
    let resolve!: (v: unknown) => void;
    const source = new AnalysisSource(() => new Promise((r) => (resolve = r)), new Fallback());
    const f = createFrame();
    source.setTrack(track("spotify:track:abc"));
    expect(source.kind).toBe("synth (loading analysis)");
    source.sample(30_000, f);
    expect(f.level).toBe(0.123);
    await flush();
    resolve(raw);
    await flush();
    expect(source.kind).toBe("analysis");
    source.sample(30_000, f);
    expect(f.level).not.toBe(0.123);
  });

  it("never fetches for ads, podcasts or local files", () => {
    const calls: string[] = [];
    const source = new AnalysisSource(async (uri) => (calls.push(uri), raw), new Fallback());
    for (const uri of ["spotify:ad:1", "spotify:episode:2", "spotify:local:a:b:c:1", null]) {
      source.setTrack(uri ? track(uri) : null);
      expect(source.kind).toBe("synth");
    }
    expect(calls).toEqual([]);
  });

  it("caches per track and waits before retrying failures", async () => {
    let now = 0;
    const calls: string[] = [];
    const source = new AnalysisSource(
      async (uri) => {
        calls.push(uri);
        if (uri.endsWith("bad")) throw new Error("429");
        return raw;
      },
      new Fallback(),
      () => now,
    );
    source.setTrack(track("spotify:track:good"));
    await flush();
    source.setTrack(track("spotify:track:bad"));
    await flush();
    expect(source.kind).toBe("synth");
    source.setTrack(track("spotify:track:good"));
    expect(source.kind).toBe("analysis");
    source.setTrack(track("spotify:track:bad"));
    now = 61_000;
    source.setTrack(track("spotify:track:bad"));
    await flush();
    expect(calls).toEqual(["spotify:track:good", "spotify:track:bad", "spotify:track:bad"]);
  });

  it("ignores a late answer for a track that's no longer playing", async () => {
    let resolve!: (v: unknown) => void;
    const source = new AnalysisSource(
      (uri) => (uri.endsWith("slow") ? new Promise((r) => (resolve = r)) : Promise.reject(new Error("x"))),
      new Fallback(),
    );
    source.setTrack(track("spotify:track:slow"));
    await flush();
    source.setTrack(track("spotify:track:other"));
    resolve(raw);
    await flush();
    expect(source.kind).toBe("synth");
  });
});
