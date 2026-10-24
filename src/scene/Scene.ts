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

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly clock: PlayerClock,
    private readonly reactor: Reactor,
    private readonly getSettings: () => Settings,
    private readonly track: SceneTrack,
    private readonly layers: Layer[],
  ) {}

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

    const track = this.track;
    const info: DrawInfo = {
      ctx,
      width,
      height,
      dpr,
      cx: width / 2,
      cy: height / 2,
      size: Math.min(width, height),
      time: (now - this.startedAt) / 1000,
      dt,
      frame,
      settings,
      track,
      color: (t) => getColor(settings, track, t),
      css: (t, alpha = 1) => toCss(getColor(settings, track, t), alpha),
    };

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
