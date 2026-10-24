import type { PlayerEvent, PlayerEventName, PlayerLike, PlayerListener } from "../spicetify";
import { attempt, num } from "../util/read";
import { readNowPlaying, type NowPlaying } from "./nowPlaying";

// fills in the position between player events, no polling
export class PlayerClock {
  track: NowPlaying | null = null;
  playing = false;

  private anchorMs = 0;
  private anchorAt = 0;
  private readonly listeners = new Set<() => void>();
  private readonly handlers: [PlayerEventName, PlayerListener][] = [
    ["songchange", (e) => this.onSongChange(e)],
    ["onplaypause", (e) => this.onPlayPause(e)],
    ["onprogress", (e) => this.onProgress(e)],
  ];

  constructor(
    private readonly player: PlayerLike | undefined,
    private readonly now: () => number = () => performance.now(),
  ) {}

  start(): void {
    this.onSongChange();
    for (const [type, fn] of this.handlers) attempt(() => this.player?.addEventListener?.(type, fn), undefined);
  }

  stop(): void {
    for (const [type, fn] of this.handlers) attempt(() => this.player?.removeEventListener?.(type, fn), undefined);
  }

  positionMs(): number {
    const pos = this.anchorMs + (this.playing ? this.now() - this.anchorAt : 0);
    const duration = this.track?.durationMs ?? 0;
    return Math.max(0, duration > 0 ? Math.min(pos, duration) : pos);
  }

  // not called on progress ticks
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private onSongChange(event?: PlayerEvent): void {
    this.track = readNowPlaying(event?.data) ?? readNowPlaying(this.player?.data);
    this.playing = this.readPlaying(this.track);
    this.anchor(this.readProgress() ?? 0);
    this.emit();
  }

  private onPlayPause(event?: PlayerEvent): void {
    const pos = this.readProgress() ?? this.positionMs();
    const track = readNowPlaying(event?.data);
    if (track) this.track = track;
    this.playing = this.readPlaying(track);
    this.anchor(pos);
    this.emit();
  }

  private onProgress(event?: PlayerEvent): void {
    const pos = num(event?.data) ?? this.readProgress();
    if (pos !== null) this.anchor(pos);
  }

  private readPlaying(track: NowPlaying | null): boolean {
    if (track?.isPaused != null) return !track.isPaused;
    const playing = attempt(() => this.player?.isPlaying?.(), undefined);
    return typeof playing === "boolean" ? playing : this.playing;
  }

  private readProgress(): number | null {
    return num(attempt(() => this.player?.getProgress?.(), undefined));
  }

  private anchor(positionMs: number): void {
    this.anchorMs = positionMs;
    this.anchorAt = this.now();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
