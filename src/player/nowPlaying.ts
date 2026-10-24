import { asObj, bool, isObj, num, str, type Obj } from "../util/read";

export type ItemKind = "track" | "episode" | "local" | "other";

export interface NowPlaying {
  uri: string | null;
  id: string | null;
  kind: ItemKind;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
  durationMs: number;
  isPaused: boolean | null;
}

// Player.data shapes seen so far:
//   { track: { uri, metadata }, is_paused, duration }
//   { item: { uri, metadata, duration: { milliseconds } }, isPaused }
//   { item: { uri, name, artists, album }, isPaused }
export function readNowPlaying(data: unknown): NowPlaying | null {
  const d = asObj(data);
  const item = isObj(d.item) ? d.item : isObj(d.track) ? d.track : null;
  if (!item) return null;

  const meta = asObj(item.metadata);
  const album = asObj(item.album);
  const uri = str(item.uri, meta.uri);
  const { kind, id } = parseUri(uri);
  const isPlaying = bool(d.isPlaying);

  return {
    uri,
    id,
    kind,
    title: str(meta.title, item.name) ?? "",
    artist: str(meta.artist_name, joinNames(item.artists)) ?? "",
    album: str(meta.album_title, album.name) ?? "",
    imageUrl: pickImage(meta, item, album),
    durationMs: Math.max(0, num(d.duration) ?? num(item.duration) ?? num(meta.duration) ?? 0),
    isPaused: bool(d.isPaused) ?? bool(d.is_paused) ?? (isPlaying === null ? null : !isPlaying),
  };
}

export function parseUri(uri: string | null): { kind: ItemKind; id: string | null } {
  const parts = (uri ?? "").split(":");
  if (parts[0] !== "spotify") return { kind: "other", id: null };
  if (parts[1] === "local") return { kind: "local", id: null };
  const id = parts[2] || null;
  if (parts[1] === "track" && id) return { kind: "track", id };
  if (parts[1] === "episode" && id) return { kind: "episode", id };
  return { kind: "other", id: null };
}

export function toImageUrl(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  if (s.startsWith("spotify:image:")) return `https://i.scdn.co/image/${s.slice("spotify:image:".length)}`;
  if (/^(https?:|data:|blob:)/.test(s)) return s;
  return null;
}

const META_IMAGE_KEYS = ["image_xlarge_url", "image_large_url", "image_url", "image_small_url"];
const LABEL_RANK: Record<string, number> = { xlarge: 4, large: 3, standard: 2, default: 2, small: 1 };

function pickImage(meta: Obj, item: Obj, album: Obj): string | null {
  for (const key of META_IMAGE_KEYS) {
    const url = toImageUrl(meta[key]);
    if (url) return url;
  }
  return largestImage(album.images) ?? largestImage(item.images);
}

function largestImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  let best: string | null = null;
  let bestScore = -1;
  for (const image of images) {
    const o = asObj(image);
    const url = toImageUrl(o.url);
    if (!url) continue;
    const score = num(o.width) ?? (LABEL_RANK[str(o.label)?.toLowerCase() ?? ""] ?? 0);
    if (score > bestScore) {
      best = url;
      bestScore = score;
    }
  }
  return best;
}

function joinNames(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  const names = list.map((entry) => str(asObj(entry).name)).filter((n): n is string => n !== null);
  return names.length ? names.join(", ") : null;
}
