import type { DrawInfo, Layer } from "../types";

export function createParticlesLayer(): Layer {
  return {
    draw(_d: DrawInfo) {},
  };
}
