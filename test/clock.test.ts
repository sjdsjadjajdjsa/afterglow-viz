import { describe, expect, it } from "vitest";
import { PlayerClock } from "../src/player/clock";
import type { PlayerEventName, PlayerLike, PlayerListener } from "../src/spicetify";

function fakePlayer(data: unknown, progress = 0) {
  const listeners = new Map<PlayerEventName, Set<PlayerListener>>();
  const player: PlayerLike & { progress: number; playing: boolean } = {
    data,
    progress,
    playing: true,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    getProgress() {
      return this.progress;
    },
    isPlaying() {
      return this.playing;
    },
  };
  const emit = (type: PlayerEventName, payload: unknown) => listeners.get(type)?.forEach((fn) => fn({ type, data: payload }));
  const count = () => [...listeners.values()].reduce((n, set) => n + set.size, 0);
  return { player, emit, count };
}

const track = (uri: string, isPaused = false) => ({
  item: { uri, metadata: { title: uri }, duration: { milliseconds: 100_000 } },
  isPaused,
});

describe("PlayerClock", () => {
  it("interpolates between progress events while playing", () => {
    let now = 1000;
    const { player, emit } = fakePlayer(track("spotify:track:a"), 5000);
    const clock = new PlayerClock(player, () => now);
    clock.start();
    expect(clock.track?.id).toBe("a");
    expect(clock.positionMs()).toBe(5000);

    now += 250;
    expect(clock.positionMs()).toBe(5250);

    emit("onprogress", 6000);
    now += 100;
    expect(clock.positionMs()).toBe(6100);
  });

  it("holds the position while paused", () => {
    let now = 0;
    const { player, emit } = fakePlayer(track("spotify:track:a"), 1000);
    const clock = new PlayerClock(player, () => now);
    clock.start();
    now = 500;
    player.progress = 1500;
    emit("onplaypause", track("spotify:track:a", true));
    expect(clock.playing).toBe(false);
    now = 5000;
    expect(clock.positionMs()).toBe(1500);
  });

  it("switches track and notifies subscribers on songchange", () => {
    const { player, emit } = fakePlayer(track("spotify:track:a"));
    const clock = new PlayerClock(player, () => 0);
    let changes = 0;
    clock.subscribe(() => changes++);
    clock.start();
    player.progress = 0;
    emit("songchange", track("spotify:track:b"));
    expect(clock.track?.id).toBe("b");
    expect(changes).toBe(2);
    emit("onprogress", 10);
    expect(changes).toBe(2);
  });

  it("uses isPlaying() when the payload doesn't say", () => {
    const { player, emit } = fakePlayer({ item: { uri: "spotify:track:a" } });
    player.playing = false;
    const clock = new PlayerClock(player, () => 0);
    clock.start();
    expect(clock.playing).toBe(false);
    player.playing = true;
    emit("onplaypause", undefined);
    expect(clock.playing).toBe(true);
  });

  it("clamps to the track duration", () => {
    let now = 0;
    const { player } = fakePlayer(track("spotify:track:a"), 99_000);
    const clock = new PlayerClock(player, () => now);
    clock.start();
    now = 10_000;
    expect(clock.positionMs()).toBe(100_000);
  });

  it("removes its listeners on stop", () => {
    const { player, count } = fakePlayer(track("spotify:track:a"));
    const clock = new PlayerClock(player, () => 0);
    clock.start();
    expect(count()).toBe(3);
    clock.stop();
    expect(count()).toBe(0);
  });

  it("survives a missing or broken player", () => {
    expect(() => new PlayerClock(undefined).start()).not.toThrow();
    const broken: PlayerLike = {
      addEventListener() {
        throw new Error("changed");
      },
      getProgress() {
        throw new Error("changed");
      },
    };
    const clock = new PlayerClock(broken, () => 0);
    expect(() => clock.start()).not.toThrow();
    expect(clock.track).toBeNull();
    expect(clock.positionMs()).toBe(0);
  });
});
