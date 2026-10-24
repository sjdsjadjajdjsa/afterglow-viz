import { describe, expect, it } from "vitest";
import { createMockSpicetify, type DataShape, type MockTrack } from "../dev/mock/spicetify";
import { probe } from "../src/diagnostics/probe";
import { PlayerClock } from "../src/player/clock";
import { readNowPlaying } from "../src/player/nowPlaying";

const tracks: MockTrack[] = [
  { uri: "spotify:track:aaa", title: "One", artist: "A", album: "X", durationMs: 60_000, tempo: 120, energy: 0.5, art: "data:image/jpeg;base64,AA" },
  { uri: "spotify:track:bbb", title: "Two", artist: "B", album: "Y", durationMs: 90_000, tempo: 90, energy: 0.8, art: null },
];

function setup() {
  let now = 0;
  const ticks: (() => void)[] = [];
  const mock = createMockSpicetify({
    tracks,
    now: () => now,
    setTimer: (fn) => {
      ticks.push(fn);
      return () => ticks.splice(ticks.indexOf(fn), 1);
    },
  });
  const advance = (ms: number) => {
    now += ms;
    ticks.forEach((fn) => fn());
  };
  return { ...mock, advance };
}

const statuses = (checks: { id: string; status: string }[]) => Object.fromEntries(checks.map((c) => [c.id, c.status]));

describe("harness mock", () => {
  it("passes every probe check when audio data is available", async () => {
    const { Spicetify } = setup();
    const s = statuses((await probe(Spicetify)).checks);
    expect(s).toMatchObject({
      spicetify: "ok",
      "player-api": "ok",
      "player-data": "ok",
      getAudioData: "ok",
      "analysis-endpoint": "ok",
      "audio-features": "ok",
    });
  });

  it("drives the probe's failure and missing paths", async () => {
    const { Spicetify, controls } = setup();
    controls.setAudio("failing");
    expect(statuses((await probe(Spicetify)).checks).getAudioData).toBe("failed");
    controls.setAudio("missing");
    expect(statuses((await probe(Spicetify)).checks).getAudioData).toBe("missing");
  });

  it("produces Player.data the app can read in every shape", () => {
    const { Spicetify, controls } = setup();
    for (const shape of ["current", "legacy", "sparse"] satisfies DataShape[]) {
      controls.setShape(shape);
      expect(readNowPlaying(Spicetify.Player.data)).toMatchObject({
        uri: "spotify:track:aaa",
        title: "One",
        artist: "A",
        album: "X",
        durationMs: 60_000,
        isPaused: true,
      });
    }
  });

  it("keeps the app's clock in step through play, progress and skips", () => {
    const { Spicetify, advance } = setup();
    const clock = new PlayerClock(Spicetify.Player, () => 0);
    clock.start();
    Spicetify.Player.togglePlay();
    expect(clock.playing).toBe(true);
    advance(1000);
    expect(clock.positionMs()).toBe(1000);
    Spicetify.Player.next();
    expect(clock.track?.title).toBe("Two");
    Spicetify.Player.seek(0.5);
    expect(clock.positionMs()).toBe(45_000);
    advance(50_000);
    expect(clock.track?.title).toBe("One");
    clock.stop();
  });
});
