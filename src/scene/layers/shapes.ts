import type { DrawInfo, Layer } from "../types";

export function createShapesLayer(): Layer {
  return {
    draw(d: DrawInfo) {
      const { ctx, frame } = d;
      ctx.strokeStyle = d.css(d.time * d.settings.color.speed * 0.1);
      ctx.lineWidth = (2 + 8 * frame.beat) * d.dpr;
      ctx.beginPath();
      ctx.arc(d.cx, d.cy, d.size * (0.25 + 0.1 * frame.level), 0, Math.PI * 2);
      ctx.stroke();
    },
  };
}
