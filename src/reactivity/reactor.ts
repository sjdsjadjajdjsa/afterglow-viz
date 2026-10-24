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
    frame.beat = finite(raw.beat) * this.live;
    frame.beatPhase = finite(raw.beatPhase);
    for (let i = 0; i < frame.bands.length; i++) {
      frame.bands[i] = follow(frame.bands[i], raw.bands[i] * this.live, dt);
    }
    return frame;
  }
}

// a NaN would otherwise stick forever, since approach() keeps it
function follow(current: number, target: number, dt: number): number {
  const to = Number.isFinite(target) ? target : 0;
  const from = Number.isFinite(current) ? current : to;
  return approach(from, to, dt, to > from ? ATTACK_MS : RELEASE_MS);
}

function finite(x: number): number {
  return Number.isFinite(x) ? x : 0;
}
