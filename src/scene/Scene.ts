import { getColor, toCss, type RGB } from "../color/getColor";
import type { PlayerClock } from "../player/clock";
import type { Reactor } from "../reactivity/reactor";
import { createFrame } from "../reactivity/types";
import type { Settings } from "../settings";
import { clamp01 } from "../util/math";
import type { Background } from "./background";
import { AutoLevel, PROFILES, type Profile } from "./performance";
import { bigChange, easeSettings, FADE_MS } from "./transition";
import type { DrawInfo, Layer, SceneTrack } from "./types";

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
  private cssRgb: RGB = [0, 0, 0];

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
      color: (t) => getColor(info.settings, track, t),
      css: (t, alpha = 1) => {
        if (t !== this.cssT) {
          this.cssT = t;
          this.cssRgb = getColor(info.settings, track, t);
        }
        return toCss(this.cssRgb, alpha);
      },
    };
    this.info = info;
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
