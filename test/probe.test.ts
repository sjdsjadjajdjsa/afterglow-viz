import { afterEach, describe, expect, it, vi } from "vitest";
import { analysisUrl, errorMessage, EventLog, featuresUrl, probe, summarizeAnalysis, summarizeFeatures } from "../src/diagnostics/probe";
import type { PlayerEventName, PlayerListener, SpicetifyLike } from "../src/spicetify";

const analysis = {
  track: { tempo: 121.5, loudness: -7, duration: 200 },
  bars: [{ start: 0 }],
  beats: [{ start: 0 }, { start: 0.5 }],
  tatums: [],
  sections: [{ start: 0 }],
  segments: [{ start: 0, pitches: new Array(12).fill(0.5), timbre: new Array(12).fill(1) }],
};
const features = { tempo: 121.5, energy: 0.72, loudness: -7, danceability: 0.6, valence: 0.4 };

const playing = (uri: string) => ({
  item: { uri, metadata: { title: "T", artist_name: "A", image_url: "https://x.test/a.jpg" }, duration: { milliseconds: 1000 } },
  isPaused: false,
});

function spicetify(overrides: Partial<SpicetifyLike> = {}, uri = "spotify:track:abc"): SpicetifyLike {
  return {
    Config: { version: "2.40.0" },
    Player: {
      data: playing(uri),
      addEventListener() {},
      removeEventListener() {},
      getProgress: () => 0,
      isPlaying: () => true,
    },
    getAudioData: async () => analysis,
    CosmosAsync: {
      async get(url: string) {
        if (url === analysisUrl("abc")) return analysis;
        if (url === featuresUrl("abc")) return features;
        throw new Error(`unexpected ${url}`);
      },
    },
    ...overrides,
  };
}

const byId = (checks: { id: string }[]) => Object.fromEntries(checks.map((c) => [c.id, c])) as Record<string, any>;

afterEach(() => {
  vi.useRealTimers();
});

describe("probe", () => {
  it("reports everything available", async () => {
    const getAudioData = vi.fn(async () => analysis);
    const result = await probe(spicetify({ getAudioData }));
    const c = byId(result.checks);
    expect(getAudioData).toHaveBeenCalledWith("spotify:track:abc");
    expect(c.spicetify.detail).toBe("2.40.0");
    expect(c["player-api"].status).toBe("ok");
    expect(c["player-data"].status).toBe("ok");
    expect(c.getAudioData.status).toBe("ok");
    expect(c.getAudioData.detail).toBe("tempo 121.5, 1 segments, 2 beats, 1 sections");
    expect(c["analysis-endpoint"].status).toBe("ok");
    expect(c["audio-features"].detail).toContain("energy 0.72");
    expect(result.nowPlaying?.id).toBe("abc");
  });

  it("reports failures with the error message", async () => {
    const result = await probe(
      spicetify({
        getAudioData: () => Promise.reject("URI is invalid."),
        CosmosAsync: { get: () => Promise.reject({ code: 403, message: "Forbidden" }) },
      }),
    );
    const c = byId(result.checks);
    expect(c.getAudioData).toMatchObject({ status: "failed", detail: "URI is invalid." });
    expect(c["analysis-endpoint"]).toMatchObject({ status: "failed", detail: "403 Forbidden" });
    expect(c["audio-features"].status).toBe("failed");
  });

  it("marks missing APIs as missing", async () => {
    const result = await probe(spicetify({ getAudioData: undefined, CosmosAsync: undefined }));
    const c = byId(result.checks);
    expect(c.getAudioData.status).toBe("missing");
    expect(c["analysis-endpoint"].status).toBe("missing");
  });

  it("waits for a real track when a local file is playing", async () => {
    const result = await probe(spicetify({}, "spotify:local:a:b:c:100"));
    expect(byId(result.checks).getAudioData.status).toBe("waiting");
  });

  it("survives no Spicetify at all", async () => {
    const result = await probe(undefined);
    const c = byId(result.checks);
    expect(c.spicetify.status).toBe("missing");
    expect(c["player-api"].status).toBe("missing");
    expect(c["player-data"].status).toBe("waiting");
  });

  it("flags Player.data it can't read", async () => {
    const S = spicetify();
    S.Player!.data = { somethingNew: { uri: "spotify:track:abc" } };
    const c = byId((await probe(S)).checks);
    expect(c["player-data"].status).toBe("failed");
  });

  it("gives up on requests that never answer", async () => {
    vi.useFakeTimers();
    const pending = probe(spicetify({ getAudioData: () => new Promise(() => {}) }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(byId((await pending).checks).getAudioData).toMatchObject({ status: "failed", detail: "No answer after 10 s" });
  });
});

describe("summaries", () => {
  it("rejects analysis without segments", () => {
    expect(summarizeAnalysis({ track: { tempo: 100 } }).usable).toBe(false);
    expect(summarizeAnalysis(null).usable).toBe(false);
  });

  it("reads features wrapped in audio_features", () => {
    const s = summarizeFeatures({ audio_features: [features] });
    expect(s.usable).toBe(true);
    expect(s.summary).toContain("tempo 121.5");
  });
});

describe("EventLog", () => {
  it("counts events and averages the interval", () => {
    const listeners = new Map<PlayerEventName, PlayerListener>();
    const player = {
      addEventListener: (type: PlayerEventName, fn: PlayerListener) => listeners.set(type, fn),
      removeEventListener: (type: PlayerEventName) => listeners.delete(type),
    };
    let now = 0;
    const log = new EventLog(player, () => now);
    log.start();
    for (let i = 0; i < 5; i++) {
      listeners.get("onprogress")?.({ data: i * 250 });
      now += 250;
    }
    listeners.get("songchange")?.({ data: { item: { uri: "spotify:track:x" } } });
    const snap = log.snapshot();
    expect(snap.onprogress).toEqual({ count: 5, everyMs: 250, lastPayload: 1000 });
    expect(snap.songchange.count).toBe(1);
    expect(snap.songchange.everyMs).toBeNull();
    expect(snap.onplaypause.count).toBe(0);
    log.stop();
    expect(listeners.size).toBe(0);
  });
});

describe("errorMessage", () => {
  it("handles the error types Spicetify throws", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage(new TypeError("bad"))).toBe("TypeError: bad");
    expect(errorMessage("URI is invalid.")).toBe("URI is invalid.");
    expect(errorMessage({ status: 404 })).toBe("404");
    expect(errorMessage({ error: { message: "nope" } })).toBe("nope");
  });
});
