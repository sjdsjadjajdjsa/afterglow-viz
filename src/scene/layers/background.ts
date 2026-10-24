import type { DrawInfo, Layer } from "../types";

export function createBackgroundLayer(): Layer {
  return {
    draw(d: DrawInfo) {
      d.ctx.fillStyle = d.settings.background.color;
      d.ctx.fillRect(0, 0, d.width, d.height);
    },
  };
}
