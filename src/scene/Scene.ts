import { getColor, type RGB } from "../color/getColor";
import type { PlayerClock } from "../player/clock";
import type { Reactor } from "../reactivity/reactor";
import { createFrame } from "../reactivity/types";
import type { Settings } from "../settings";
import { clamp01 } from "../util/math";
import type { Background } from "./background";
import { AutoLevel, PROFILES, type Profile } from "./performance";
import { bigChange, easeSettings, FADE_MS } from "./transition";
import type { DrawInfo, Layer, SceneTrack } from "./types";

const CSS_CACHE_SIZE = 4096;
const Q = 127 / 255;

export class Scene {
  private raf = 0;
  private last = 0;
  private due = 0;
  private startedAt = 0;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly scaled = createFrame();
  private readonly broken = new Set<Layer>();
  private readonly auto = new AutoLevel();
  // reused every frame instead of rebuilt
  private readonly info: DrawInfo;
  // the last frame before a big settings change, faded out over the new one
  private snapshot: HTMLCanvasElement | null = null;
  private fadeFrom = -Infinity;
  private lastSettings: Settings | null = null;
  // what's drawn: the settings with numbers easing toward the real ones
  private shown: Settings | null = null;
  // the shapes ask for the same color a few times in a row, once per stroke
  private cssT = NaN;
  private readonly cssRgb: RGB = [0, 0, 0];
  private readonly colorRgb: RGB = [0, 0, 0];
  private readonly cssCache = new Map<number, string>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly clock: PlayerClock,
    private readonly reactor: Reactor,
    private readonly getSettings: () => Settings,
    private readonly track: SceneTrack,
    private readonly layers: Layer[],
    private readonly background: Background | null = null,
  ) {
    const info: DrawInfo = {
      ctx: null!,
      width: 1,
      height: 1,
      dpr: 1,
      cx: 0,
      cy: 0,
      size: 1,
      time: 0,
      dt: 0,
      frame: this.scaled,
      settings: getSettings(),
      profile: PROFILES.balanced,
      track,
      color: (t) => getColor(info.settings, track, t, this.colorRgb),
      css: (t, alpha = 1) => {
        if (t !== this.cssT) {
          this.cssT = t;
          getColor(info.settings, track, t, this.cssRgb);
        }
        return this.cssString(alpha);
      },
    };
    this.info = info;
  }

  // canvas keeps 8 bit alpha anyway, so equal keys look identical
  // 7 bits per channel and 8 bits of alpha keep the key a small integer, so
  // looking it up allocates nothing. the rounding is under one color step
  private cssString(alpha: number): string {
    const rgb = this.cssRgb;
    const r = Math.round(rgb[0] * Q);
    const g = Math.round(rgb[1] * Q);
    const b = Math.round(rgb[2] * Q);
    const a = Math.round((alpha < 0 ? 0 : alpha > 1 ? 1 : alpha) * 255);
    const key = (((((r << 7) | g) << 7) | b) << 8) | a;
    let css = this.cssCache.get(key);
    if (css === undefined) {
      if (this.cssCache.size >= CSS_CACHE_SIZE) this.cssCache.clear();
      css = `rgba(${Math.round(r / Q)},${Math.round(g / Q)},${Math.round(b / Q)},${(a / 255).toFixed(3)})`;
      this.cssCache.set(key, css);
    }
    return css;
  }

  start(): void {
    this.startedAt = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private profile(settings: Settings): Profile {
    if (settings.performance !== "auto") {
      this.auto.reset();
      return PROFILES[settings.performance];
    }
    return PROFILES[this.auto.level];
  }

  private tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    const settings = this.getSettings();
    const profile = this.profile(settings);
    const fps = this.clock.playing ? profile.fps : profile.pausedFps;
    // high refresh screens would otherwise draw two or more times as often
    if (fps > 0) {
      if (now < this.due - 1) return;
      this.due = Math.max(this.due + 1000 / fps, now);
    }
    const ctx = (this.ctx ??= this.canvas.getContext("2d"));
    if (!ctx) return;
    const started = performance.now();
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;

    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    const screenDpr = window.devicePixelRatio || 1;
    const dpr = screenDpr * Math.min(1, Math.sqrt(profile.pixels / Math.max(1, cw * ch * screenDpr * screenDpr)));
    const width = Math.max(1, Math.round(cw * dpr));
    const height = Math.max(1, Math.round(ch * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.lastSettings && settings !== this.lastSettings && bigChange(this.lastSettings, settings)) {
      this.takeSnapshot(now);
    }
    this.lastSettings = settings;
    if (!this.shown) this.shown = structuredClone(settings);
    else easeSettings(this.shown, settings, dt * 1000);
    const shown = this.shown;
    const raw = this.reactor.update(this.clock.positionMs(), this.clock.playing, dt * 1000);
    const frame = this.scaled;
    const s = shown.sensitivity;
    frame.level = clamp01(raw.level * s);
    frame.beat = clamp01(raw.beat * s);
    frame.beatPhase = raw.beatPhase;
    for (let i = 0; i < frame.bands.length; i++) frame.bands[i] = clamp01(raw.bands[i] * s);

    const info = this.info;
    info.ctx = ctx;
    info.width = width;
    info.height = height;
    info.dpr = dpr;
    info.cx = width / 2;
    info.cy = height / 2;
    info.size = Math.min(width, height);
    info.time = (now - this.startedAt) / 1000;
    info.dt = dt;
    info.settings = shown;
    info.profile = profile;
    this.cssT = NaN;

    try {
      this.background?.update(info);
    } catch (error) {
      this.report(null, error);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const layer of this.layers) {
      ctx.save();
      try {
        layer.draw(info);
      } catch (error) {
        this.report(layer, error);
      }
      ctx.restore();
    }

    const fade = 1 - (now - this.fadeFrom) / FADE_MS;
    if (fade > 0 && this.snapshot) {
      ctx.globalAlpha = fade * fade;
      ctx.drawImage(this.snapshot, 0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    if (settings.performance === "auto") this.auto.record(now, performance.now() - started, profile);
  };

  private report(layer: Layer | null, error: unknown): void {
    const key = layer ?? (this as unknown as Layer);
    if (this.broken.has(key)) return;
    this.broken.add(key);
    console.error("[afterglow-viz] layer failed", error);
  }

  private takeSnapshot(now: number): void {
    const { canvas } = this;
    const snap = (this.snapshot ??= document.createElement("canvas"));
    if (snap.width !== canvas.width || snap.height !== canvas.height) {
      snap.width = canvas.width;
      snap.height = canvas.height;
    }
    const sctx = snap.getContext("2d");
    if (!sctx) return;
    sctx.clearRect(0, 0, snap.width, snap.height);
    // the background sits behind the canvas, so it goes into the snapshot too
    this.background?.paint(sctx, snap.width, snap.height);
    sctx.drawImage(canvas, 0, 0);
    this.fadeFrom = now;
  }
}
