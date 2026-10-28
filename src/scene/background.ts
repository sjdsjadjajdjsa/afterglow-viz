import { approach } from "../util/math";
import { blurCanvasSize, dimAlpha, RenderKey } from "./extras/backdrop";
import { coverCrop, createCrop } from "./extras/cover";
import type { DrawInfo } from "./types";

const FADE_S = 1.2;

// the backgrounds are soft all over, so they live on small canvases behind the
// main one and the browser stretches, moves and dims them. the blurred art is
// only painted when the art or size changes, then just moved each frame
export class Background {
  private readonly grad = layer();
  private prev = layer();
  private cur = layer();
  private readonly key = new RenderKey<HTMLImageElement>();
  private readonly crop = createCrop();
  private readonly styles = new Map<HTMLElement, Record<string, string>>();
  private hasPrev = false;
  private mix = 1;
  private visible = 0;
  // what is shown now, so a snapshot can paint the same thing
  private kind: DrawInfo["settings"]["background"]["kind"] = "solid";
  private color = "#000000";
  private gradAlpha = 0;
  private prevAlpha = 0;
  private curAlpha = 0;
  private dimA = 0;
  private scale = 1;
  private ox = 0;
  private oy = 0;

  constructor(private readonly root: HTMLElement) {
    root.append(this.grad, this.prev, this.cur);
  }

  dispose(): void {
    for (const el of [this.grad, this.prev, this.cur]) el.remove();
    this.root.style.background = "";
    this.root.style.opacity = "";
  }

  update(d: DrawInfo): void {
    const bg = d.settings.background;
    this.kind = bg.kind;
    this.color = bg.color;
    this.dimA = dimAlpha(bg.dim, d.frame.level);
    this.set(this.root, "background", bg.kind === "solid" ? bg.color : "");
    // over the black behind it, fading the whole background is the same as a black layer on top, and costs no extra layer
    this.set(this.root, "opacity", (1 - this.dimA).toFixed(3));

    if (bg.kind === "solid") {
      this.gradAlpha = this.prevAlpha = this.curAlpha = 0;
    } else if (bg.kind === "gradient") {
      this.gradAlpha = 1;
      this.prevAlpha = this.curAlpha = 0;
    } else {
      this.updateArt(d);
    }
    if (this.gradAlpha > 0) drawGradient(this.grad, d);

    const t = d.time;
    // slow breathing and drift, a touch bigger when it's loud. 1.08 leaves room for the drift
    this.scale = 1.08 + 0.025 * Math.sin(t * 0.07) + 0.02 * d.frame.level;
    this.ox = Math.sin(t * 0.031) * 0.015;
    this.oy = Math.cos(t * 0.023) * 0.015;
    const transform = `translate(${(this.ox * 100).toFixed(3)}%,${(this.oy * 100).toFixed(3)}%) scale(${this.scale.toFixed(4)})`;
    this.show(this.grad, this.gradAlpha, "none");
    this.show(this.prev, this.hasPrev ? this.prevAlpha : 0, transform);
    this.show(this.cur, this.curAlpha, transform);
  }

  // the background as it looks now, for the crossfade snapshot
  paint(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = this.kind === "solid" ? this.color : "#000";
    ctx.fillRect(0, 0, width, height);
    if (this.gradAlpha > 0) {
      ctx.globalAlpha = this.gradAlpha;
      ctx.drawImage(this.grad, 0, 0, width, height);
    }
    const sw = width * this.scale;
    const sh = height * this.scale;
    const x = (width - sw) / 2 + this.ox * width;
    const y = (height - sh) / 2 + this.oy * height;
    for (const [c, a] of [[this.prev, this.hasPrev ? this.prevAlpha : 0], [this.cur, this.curAlpha]] as const) {
      if (a <= 0.002 || c.width < 2) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(c, x, y, sw, sh);
    }
    ctx.globalAlpha = this.dimA;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  private updateArt(d: DrawInfo): void {
    const img = d.track.art;
    const [bw, bh] = blurCanvasSize(d.width, d.height);
    if (img && !this.key.matches(img, bw, bh)) {
      if (this.key.sourceChanged(img) && this.visible > 0.01) {
        const t = this.prev;
        this.prev = this.cur;
        this.cur = t;
        // the new art goes on top
        this.root.append(this.cur);
        this.hasPrev = true;
        this.mix = 0;
      } else {
        this.hasPrev = false;
        this.mix = 1;
      }
      this.renderBlur(img, this.cur, bw, bh);
      this.key.set(img, bw, bh);
    }
    this.visible = approach(this.visible, img ? 1 : 0, d.dt * 1000, 450);
    this.mix = Math.min(1, this.mix + d.dt / FADE_S);
    if (this.mix >= 1) this.hasPrev = false;
    this.gradAlpha = this.visible < 0.999 ? 1 : 0;
    this.prevAlpha = this.visible;
    this.curAlpha = this.visible * this.mix;
  }

  private renderBlur(img: HTMLImageElement, target: HTMLCanvasElement, bw: number, bh: number): void {
    target.width = bw;
    target.height = bh;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    const blur = Math.max(bw, bh) * 0.045;
    // draw past the edges so the blur doesn't pull in transparent black there
    const pad = blur * 2.5;
    const crop = this.crop;
    coverCrop(img.naturalWidth || img.width, img.naturalHeight || img.height, (bw + pad * 2) / (bh + pad * 2), crop);
    ctx.filter = `blur(${blur.toFixed(1)}px) saturate(1.35) brightness(0.82)`;
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, -pad, -pad, bw + pad * 2, bh + pad * 2);
    ctx.filter = "none";
    const v = ctx.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * 0.25, bw / 2, bh / 2, Math.hypot(bw, bh) / 2);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, bw, bh);
  }

  private show(el: HTMLElement, alpha: number, transform: string): void {
    const on = alpha > 0.002;
    this.set(el, "display", on ? "" : "none");
    if (!on) return;
    this.set(el, "opacity", alpha >= 0.999 ? "1" : alpha.toFixed(3));
    this.set(el, "transform", transform);
  }

  // style writes only when the value changes, so a still background costs nothing
  private set(el: HTMLElement, prop: "background" | "opacity" | "transform" | "display", value: string): void {
    let last = this.styles.get(el);
    if (!last) this.styles.set(el, (last = {}));
    if (last[prop] === value) return;
    last[prop] = value;
    el.style[prop] = value;
  }
}

function layer(): HTMLCanvasElement {
  const el = document.createElement("canvas");
  el.className = "agv-bg-layer";
  el.style.display = "none";
  return el;
}

// a dark base with a few big soft blobs of palette color wandering around it
function drawGradient(canvas: HTMLCanvasElement, d: DrawInfo): void {
  const [width, height] = blurCanvasSize(d.width, d.height, 320);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const time = d.time;
  const shift = time * d.settings.color.speed * 0.05;
  const base = d.color(shift);
  ctx.fillStyle = `rgb(${Math.round(base[0] * 0.1)},${Math.round(base[1] * 0.1)},${Math.round(base[2] * 0.1)})`;
  ctx.fillRect(0, 0, width, height);
  const reach = Math.max(width, height) * 0.75;
  const glow = 0.42 + 0.12 * d.frame.level;
  for (let k = 0; k < 3; k++) {
    const c = d.color(shift + k / 3);
    const x = width / 2 + Math.cos(time * (0.043 + 0.017 * k) + k * 2.1) * width * 0.38;
    const y = height / 2 + Math.sin(time * (0.037 + 0.013 * k) + k * 1.3) * height * 0.36;
    const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
    const rgb = `${Math.round(c[0] * 0.8)},${Math.round(c[1] * 0.8)},${Math.round(c[2] * 0.8)}`;
    g.addColorStop(0, `rgba(${rgb},${glow.toFixed(3)})`);
    g.addColorStop(0.45, `rgba(${rgb},${(glow * 0.35).toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
}
