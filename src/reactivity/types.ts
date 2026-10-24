export const BAND_COUNT = 32;

// all 0..1
export interface ReactiveFrame {
  level: number;
  beat: number;
  // 0 on the beat, almost 1 right before the next
  beatPhase: number;
  bands: Float32Array;
}

export interface TrackContext {
  uri: string | null;
  id: string | null;
  durationMs: number;
  tempo?: number;
  energy?: number;
}

export interface ReactivitySource {
  readonly kind: string;
  setTrack(track: TrackContext | null): void;
  // runs every frame, don't allocate
  sample(positionMs: number, out: ReactiveFrame): void;
  dispose?(): void;
}

export function createFrame(): ReactiveFrame {
  return { level: 0, beat: 0, beatPhase: 0, bands: new Float32Array(BAND_COUNT) };
}
