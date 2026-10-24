import { describe, expect, it } from "vitest";
import { Reactor } from "../src/reactivity/reactor";
import type { ReactiveFrame, ReactivitySource, TrackContext } from "../src/reactivity/types";

class ConstantSource implements ReactivitySource {
  tracks: (TrackContext | null)[] = [];
  disposed = false;
  constructor(readonly kind: string, private readonly value: number) {}
  setTrack(track: TrackContext | null) {
    this.tracks.push(track);
  }
  sample(_pos: number, out: ReactiveFrame) {
    out.level = this.value;
    out.beat = this.value;
    out.beatPhase = 0.25;
    out.bands.fill(this.value);
  }
  dispose() {
    this.disposed = true;
  }
}

function run(reactor: Reactor, playing: boolean, ms: number) {
  for (let t = 0; t < ms; t += 16) reactor.update(0, playing, 16);
  return reactor.frame;
}

describe("Reactor", () => {
  it("settles on the source's values while playing", () => {
    const reactor = new Reactor(new ConstantSource("c", 0.8));
    const f = run(reactor, true, 3000);
    expect(f.level).toBeCloseTo(0.8, 2);
    expect(f.bands[5]).toBeCloseTo(0.8, 2);
    expect(f.beatPhase).toBe(0.25);
  });

  it("eases to rest when paused instead of cutting out", () => {
    const reactor = new Reactor(new ConstantSource("c", 0.8));
    run(reactor, true, 3000);
    reactor.update(0, false, 16);
    expect(reactor.frame.level).toBeGreaterThan(0.7);
    const f = run(reactor, false, 3000);
    expect(f.level).toBeLessThan(0.01);
    expect(f.bands[0]).toBeLessThan(0.01);
  });

  it("ignores huge frame gaps", () => {
    const reactor = new Reactor(new ConstantSource("c", 1));
    reactor.update(0, true, 60_000);
    expect(reactor.frame.level).toBeLessThan(1);
    expect(reactor.frame.level).toBeGreaterThan(0);
  });

  it("swaps sources, passing the current track and disposing the old one", () => {
    const first = new ConstantSource("first", 0.2);
    const second = new ConstantSource("second", 0.9);
    const reactor = new Reactor(first);
    const track: TrackContext = { uri: "spotify:track:x", id: "x", durationMs: 1000 };
    reactor.setTrack(track);
    reactor.setSource(second);
    expect(reactor.kind).toBe("second");
    expect(first.disposed).toBe(true);
    expect(second.tracks).toEqual([track]);
    expect(run(reactor, true, 3000).level).toBeCloseTo(0.9, 2);
  });

  it("recovers from a NaN frame", () => {
    let bad = true;
    const source: ReactivitySource = {
      kind: "nan",
      setTrack() {},
      sample(_pos, out) {
        out.level = bad ? NaN : 0.5;
        out.beat = bad ? NaN : 0;
        out.beatPhase = 0;
        out.bands.fill(bad ? NaN : 0.5);
      },
    };
    const reactor = new Reactor(source);
    run(reactor, true, 500);
    for (const v of [reactor.frame.level, reactor.frame.beat, reactor.frame.bands[0]]) expect(Number.isFinite(v)).toBe(true);
    bad = false;
    expect(run(reactor, true, 3000).level).toBeCloseTo(0.5, 2);
  });
});
