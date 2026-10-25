import { getColor, toCss } from "../color/getColor";
import type { PlayerClock } from "../player/clock";
import type { Reactor } from "../reactivity/reactor";
import { createFrame } from "../reactivity/types";
import type { Settings } from "../settings";
import { clamp01 } from "../util/math";
import { bigChange, easeSettings, FADE_MS } from "./transition";
import type { DrawInfo, Layer, SceneTrack } from "./types";

export class Scene {
  private raf = 0;
  private last = 0;
  private startedAt = 0;
  private readonly scaled = createFrame();
  private readonly broken = new Set<Layer>();
  // reused every frame instead of rebuilt
  private readonly info: DrawInfo;
  // the last frame before a big settings change, faded out over the new one
  private snapshot: HTMLCanvasElement | null = null;
  private fadeFrom = -Infinity;
  private lastSettings: Settings | null = null;
  // what's drawn: the settings with numbers easing toward the real ones
  private shown: Settings | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly clock: PlayerClock,
    private readonly reactor: Reactor,
    private readonly getSettings: () => Settings,
    private readonly track: SceneTrack,
    private readonly layers: Layer[],
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
      track,
      color: (t) => getColor(info.settings, track, t),
      css: (t, alpha = 1) => toCss(getColor(info.settings, track, t), alpha),
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

  private tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const settings = this.getSettings();
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const layer of this.layers) {
      ctx.save();
      try {
        layer.draw(info);
      } catch (error) {
        if (!this.broken.has(layer)) {
          this.broken.add(layer);
          console.error("[afterglow-viz] layer failed", error);
        }
      }
      ctx.restore();
    }

    const fade = 1 - (now - this.fadeFrom) / FADE_MS;
    if (fade > 0 && this.snapshot) {
      ctx.globalAlpha = fade * fade;
      ctx.drawImage(this.snapshot, 0, 0, width, height);
      ctx.globalAlpha = 1;
    }
  };

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
    sctx.drawImage(canvas, 0, 0);
    this.fadeFrom = now;
  }
}
