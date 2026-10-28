import type { Settings } from "../settings";

export type Level = Exclude<Settings["performance"], "auto">;

export interface Profile {
  level: Level;
  // frames per second while playing and paused, 0 draws on every display frame
  fps: number;
  pausedFps: number;
  // most device pixels the main canvas renders, the browser scales it up past that
  pixels: number;
  // soft strokes drawn around each ring
  ringHalo: 0 | 1 | 2;
  ringSteps: number;
  spectrumGlow: boolean;
  // share of the particle amount that is drawn
  particles: number;
}

export const PROFILES: Record<Level, Profile> = {
  quality: { level: "quality", fps: 0, pausedFps: 60, pixels: Infinity, ringHalo: 2, ringSteps: 160, spectrumGlow: true, particles: 1 },
  balanced: { level: "balanced", fps: 60, pausedFps: 30, pixels: 2_000_000, ringHalo: 2, ringSteps: 120, spectrumGlow: true, particles: 1 },
  saver: { level: "saver", fps: 30, pausedFps: 15, pixels: 1_000_000, ringHalo: 1, ringSteps: 80, spectrumGlow: false, particles: 0.5 },
};

const WINDOW_MS = 2000;
// longer than this between frames means the page was hidden or busy elsewhere, not slow
const GAP_MS = 500;

// auto starts balanced and drops to saver for good once frames keep coming
// late or the drawing itself eats most of the frame
export class AutoLevel {
  level: Level = "balanced";
  private since = 0;
  private frames = 0;
  private work = 0;
  private last = 0;

  reset(): void {
    this.level = "balanced";
    this.since = 0;
  }

  record(now: number, workMs: number, profile: Profile): void {
    if (this.level === "saver") return;
    if (!this.since || now - this.last > GAP_MS) {
      this.since = now;
      this.frames = 0;
      this.work = 0;
    }
    this.last = now;
    this.frames++;
    this.work += workMs;
    const span = now - this.since;
    if (span < WINDOW_MS) return;
    const fps = (this.frames * 1000) / span;
    const budget = 1000 / (profile.fps || 60);
    if (fps < 0.8 * (profile.fps || 60) || this.work / this.frames > 0.6 * budget) this.level = "saver";
    this.since = now;
    this.frames = 0;
    this.work = 0;
  }
}
