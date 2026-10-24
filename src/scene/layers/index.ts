import type { Layer } from "../types";
import { createBackgroundLayer } from "./background";
import { createCenterpieceLayer } from "./centerpiece";
import { createParticlesLayer } from "./particles";
import { createShapesLayer } from "./shapes";

export function createLayers(): Layer[] {
  return [createBackgroundLayer(), createParticlesLayer(), createShapesLayer(), createCenterpieceLayer()];
}
