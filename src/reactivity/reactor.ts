import { approach } from "../util/math";
import { createFrame, type ReactiveFrame, type ReactivitySource, type TrackContext } from "./types";

const ATTACK_MS = 40;
const RELEASE_MS = 220;
const PAUSE_EASE_MS = 450;
const MAX_STEP_MS = 250;

// smooths whatever the source gives and eases to rest on pause
export class Reactor {
  readonly frame = createFrame();
  private readonly raw = createFrame();
  private live = 0;
  private track: TrackContext | null = null;

  constructor(private source: ReactivitySource) {}

  get kind(): string {
    return this.source.kind;
  }

  setSource(source: ReactivitySource): void {
    if (source === this.source) return;
    this.source.dispose?.();
    this.source = source;
    source.setTrack(this.track);
  }

  setTrack(track: TrackContext | null): void {
    this.track = track;
    this.source.setTrack(track);
  }

  update(positionMs: number, playing: boolean, dtMs: number): ReactiveFrame {
    const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS);
    const { frame, raw } = this;
    this.source.sample(positionMs, raw);
    this.live = approach(this.live, playing ? 1 : 0, dt, PAUSE_EASE_MS);

    frame.level = follow(frame.level, raw.level * this.live, dt);
    frame.beat = raw.beat * this.live;
    frame.beatPhase = raw.beatPhase;
    for (let i = 0; i < frame.bands.length; i++) {
      frame.bands[i] = follow(frame.bands[i], raw.bands[i] * this.live, dt);
    }
    return frame;
  }
}

function follow(current: number, target: number, dt: number): number {
  return approach(current, target, dt, target > current ? ATTACK_MS : RELEASE_MS);
}
