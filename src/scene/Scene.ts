import { getColor, toCss } from "../color/getColor";
import type { PlayerClock } from "../player/clock";
import type { Reactor } from "../reactivity/reactor";
import { createFrame } from "../reactivity/types";
import type { Settings } from "../settings";
import { clamp01 } from "../util/math";
import type { DrawInfo, Layer, SceneTrack } from "./types";

export class Scene {
  private raf = 0;
  private last = 0;
  private startedAt = 0;
  private readonly scaled = createFrame();
  private readonly broken = new Set<Layer>();
  // reused every frame instead of rebuilt
  private readonly info: DrawInfo;

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
    const raw = this.reactor.update(this.clock.positionMs(), this.clock.playing, dt * 1000);
    const frame = this.scaled;
    const s = settings.sensitivity;
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
    info.settings = settings;

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
  };
}
