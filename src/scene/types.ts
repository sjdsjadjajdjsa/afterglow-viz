import type { ColorTrack, RGB } from "../color/getColor";
import type { NowPlaying } from "../player/nowPlaying";
import type { ReactiveFrame } from "../reactivity/types";
import type { Settings } from "../settings";
import type { Profile } from "./performance";

export interface SceneTrack extends ColorTrack {
  nowPlaying: NowPlaying | null;
  // loaded and ready to draw, null while loading or if there is none
  art: HTMLImageElement | null;
  centerImage: HTMLImageElement | null;
}

export interface DrawInfo {
  ctx: CanvasRenderingContext2D;
  // canvas size in device pixels
  width: number;
  height: number;
  dpr: number;
  cx: number;
  cy: number;
  // min(width, height), the unit most sizes scale from
  size: number;
  // seconds since the scene started, and since the last frame
  time: number;
  dt: number;
  frame: ReactiveFrame;
  settings: Settings;
  profile: Profile;
  track: SceneTrack;
  // getColor(settings, track, t)
  color(t: number): RGB;
  css(t: number, alpha?: number): string;
}

// layers draw in a fixed order: background, particles, shapes, centerpiece
export interface Layer {
  draw(d: DrawInfo): void;
}
