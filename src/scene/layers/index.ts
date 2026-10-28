import type { Layer } from "../types";
import { createCenterpieceLayer } from "./centerpiece";
import { createParticlesLayer } from "./particles";
import { createShapesLayer } from "./shapes";

export function createLayers(): Layer[] {
  return [createParticlesLayer(), createShapesLayer(), createCenterpieceLayer()];
}
