import { extractPalette } from "../color/palette";
import type { NowPlaying } from "../player/nowPlaying";
import type { SceneTrack } from "./types";

// loads album art and the user's centerpiece image, and their palettes
export class TrackAssets {
  readonly track: SceneTrack = { nowPlaying: null, art: null, centerImage: null, artPalette: null, centerPalette: null };
  private artUrl: string | null = null;
  private centerSrc: string | null = null;

  setNowPlaying(np: NowPlaying | null): void {
    this.track.nowPlaying = np;
    const url = np?.imageUrl ?? null;
    if (url === this.artUrl) return;
    this.artUrl = url;
    if (!url) {
      this.track.art = null;
      this.track.artPalette = null;
      return;
    }
    loadImage(url, (img, readable) => {
      if (this.artUrl !== url) return;
      this.track.art = img;
      this.track.artPalette = readable ? safePalette(img) : null;
    });
  }

  setCenterImage(src: string | null): void {
    if (src === this.centerSrc) return;
    this.centerSrc = src;
    this.track.centerImage = null;
    this.track.centerPalette = null;
    if (!src) return;
    loadImage(src, (img, readable) => {
      if (this.centerSrc !== src) return;
      this.track.centerImage = img;
      this.track.centerPalette = readable ? safePalette(img) : null;
    });
  }
}

// tries with cors first so the pixels can be read for the palette; if the
// server refuses, loads it plain so it can still be drawn
function loadImage(url: string, done: (img: HTMLImageElement, readable: boolean) => void): void {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => done(img, true);
  img.onerror = () => {
    const plain = new Image();
    plain.onload = () => done(plain, false);
    plain.src = url;
  };
  img.src = url;
}

function safePalette(img: HTMLImageElement) {
  try {
    return extractPalette(img);
  } catch {
    return null;
  }
}
