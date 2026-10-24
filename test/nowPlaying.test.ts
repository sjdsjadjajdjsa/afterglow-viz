import { describe, expect, it } from "vitest";
import { parseUri, readNowPlaying, toImageUrl } from "../src/player/nowPlaying";

describe("readNowPlaying", () => {
  it("reads the current item + metadata shape", () => {
    const np = readNowPlaying({
      item: {
        uri: "spotify:track:abc123",
        metadata: {
          title: "Song",
          artist_name: "Artist",
          album_title: "Album",
          image_large_url: "spotify:image:ab67616d0000b273ff",
          image_url: "spotify:image:small",
        },
        duration: { milliseconds: 201000 },
      },
      isPaused: false,
    });
    expect(np).toEqual({
      uri: "spotify:track:abc123",
      id: "abc123",
      kind: "track",
      title: "Song",
      artist: "Artist",
      album: "Album",
      imageUrl: "https://i.scdn.co/image/ab67616d0000b273ff",
      durationMs: 201000,
      isPaused: false,
    });
  });

  it("reads the older track + is_paused shape", () => {
    const np = readNowPlaying({
      track: {
        uri: "spotify:track:old",
        metadata: { title: "Old", artist_name: "Band", album_title: "LP", image_url: "https://example.test/a.jpg", duration: "180000" },
      },
      is_paused: true,
      duration: 180500,
    });
    expect(np?.title).toBe("Old");
    expect(np?.isPaused).toBe(true);
    expect(np?.durationMs).toBe(180500);
    expect(np?.imageUrl).toBe("https://example.test/a.jpg");
  });

  it("falls back to name, artists and album images when metadata is missing", () => {
    const np = readNowPlaying({
      item: {
        uri: "spotify:track:sparse",
        name: "Sparse",
        artists: [{ name: "One" }, { name: "Two" }, { nope: 1 }],
        album: {
          name: "Collection",
          images: [
            { url: "spotify:image:small", label: "small" },
            { url: "spotify:image:big", label: "xlarge" },
            { url: "spotify:image:std", label: "standard" },
          ],
        },
        duration: { milliseconds: 1000 },
      },
      isPlaying: true,
    });
    expect(np?.title).toBe("Sparse");
    expect(np?.artist).toBe("One, Two");
    expect(np?.album).toBe("Collection");
    expect(np?.imageUrl).toBe("https://i.scdn.co/image/big");
    expect(np?.isPaused).toBe(false);
  });

  it("prefers the widest image when widths are given", () => {
    const np = readNowPlaying({
      item: { uri: "spotify:track:w", images: [{ url: "https://x.test/64", width: 64 }, { url: "https://x.test/640", width: 640 }] },
    });
    expect(np?.imageUrl).toBe("https://x.test/640");
  });

  it("returns null when there is no item", () => {
    for (const input of [undefined, null, 0, "x", [], {}, { item: null }, { track: "nope" }]) {
      expect(readNowPlaying(input)).toBeNull();
    }
  });

  it("tolerates junk in every field", () => {
    const np = readNowPlaying({
      item: { uri: 42, metadata: "bad", artists: "bad", album: [], duration: "soon", images: [null, 3, { url: 7 }] },
      isPaused: "yes",
      duration: NaN,
    });
    expect(np).toEqual({
      uri: null,
      id: null,
      kind: "other",
      title: "",
      artist: "",
      album: "",
      imageUrl: null,
      durationMs: 0,
      isPaused: null,
    });
  });
});

describe("parseUri", () => {
  it("splits track, episode and local uris", () => {
    expect(parseUri("spotify:track:1")).toEqual({ kind: "track", id: "1" });
    expect(parseUri("spotify:episode:2")).toEqual({ kind: "episode", id: "2" });
    expect(parseUri("spotify:local:Artist:Album:Title:200")).toEqual({ kind: "local", id: null });
    expect(parseUri("spotify:track:")).toEqual({ kind: "other", id: null });
    expect(parseUri(null)).toEqual({ kind: "other", id: null });
  });
});

describe("toImageUrl", () => {
  it("only returns URLs an <img> or canvas can load", () => {
    expect(toImageUrl("spotify:image:abc")).toBe("https://i.scdn.co/image/abc");
    expect(toImageUrl("data:image/png;base64,AA")).toBe("data:image/png;base64,AA");
    expect(toImageUrl("spotify:localfileimage:C:/x.jpg")).toBeNull();
    expect(toImageUrl("")).toBeNull();
    expect(toImageUrl(undefined)).toBeNull();
  });
});
