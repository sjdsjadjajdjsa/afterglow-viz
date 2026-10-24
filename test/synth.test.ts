import { describe, expect, it } from "vitest";
import { foldTempo, SynthSource } from "../src/reactivity/synth";
import { createFrame, type ReactiveFrame, type TrackContext } from "../src/reactivity/types";

const track = (uri: string, extra: Partial<TrackContext> = {}): TrackContext => ({
  uri,
  id: uri.split(":")[2] ?? null,
  durationMs: 240_000,
  ...extra,
});

function sampleAt(source: SynthSource, pos: number): ReactiveFrame {
  const frame = createFrame();
  source.sample(pos, frame);
  return frame;
}

describe("SynthSource", () => {
  it("is deterministic for the same track and position", () => {
    const a = new SynthSource();
    const b = new SynthSource();
    a.setTrack(track("spotify:track:same"));
    b.setTrack(track("spotify:track:same"));
    for (const pos of [3000, 45_678, 120_000]) {
      expect(sampleAt(a, pos)).toEqual(sampleAt(b, pos));
    }
  });

  it("gives different tracks different motion", () => {
    const a = new SynthSource();
    const b = new SynthSource();
    a.setTrack(track("spotify:track:one"));
    b.setTrack(track("spotify:track:two"));
    expect(Array.from(sampleAt(a, 60_000).bands)).not.toEqual(Array.from(sampleAt(b, 60_000).bands));
  });

  it("keeps every value in 0..1", () => {
    const source = new SynthSource();
    for (let t = 0; t < 20; t++) {
      source.setTrack(track(`spotify:track:t${t}`, { energy: t % 2 ? 1 : 0, tempo: 60 + t * 9 }));
      for (let pos = -1000; pos < 250_000; pos += 1337) {
        const f = sampleAt(source, pos);
        for (const v of [f.level, f.beat, f.beatPhase, ...f.bands]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("pulses on the beat of a known tempo", () => {
    const source = new SynthSource();
    source.setTrack(track("spotify:track:beat", { tempo: 120 }));
    const onBeat = sampleAt(source, 60_000);
    const between = sampleAt(source, 60_400);
    expect(onBeat.beatPhase).toBeCloseTo(0, 5);
    expect(between.beatPhase).toBeCloseTo(0.8, 5);
    expect(onBeat.beat).toBeGreaterThan(0.9);
    expect(between.beat).toBeLessThan(0.1);
  });

  it("fades in at the start and out at the end", () => {
    const source = new SynthSource();
    source.setTrack(track("spotify:track:fade", { durationMs: 200_000 }));
    expect(sampleAt(source, 0).level).toBe(0);
    expect(sampleAt(source, 200_000).level).toBe(0);
    expect(sampleAt(source, 100_000).level).toBeGreaterThan(0.2);
  });

  it("drives harder with more energy", () => {
    const calm = new SynthSource();
    const loud = new SynthSource();
    calm.setTrack(track("spotify:track:e", { energy: 0.1 }));
    loud.setTrack(track("spotify:track:e", { energy: 0.9 }));
    expect(sampleAt(loud, 90_000).level).toBeGreaterThan(sampleAt(calm, 90_000).level);
  });

  it("works with no track at all", () => {
    const source = new SynthSource();
    source.setTrack(null);
    const f = sampleAt(source, 30_000);
    expect(f.level).toBeGreaterThan(0);
    expect(Number.isFinite(f.bands[0])).toBe(true);
  });
});

describe("foldTempo", () => {
  it("folds into 70..160", () => {
    expect(foldTempo(174)).toBe(87);
    expect(foldTempo(60)).toBe(120);
    expect(foldTempo(128)).toBe(128);
  });
});
