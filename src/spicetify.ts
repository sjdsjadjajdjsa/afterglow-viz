// all optional, these move around between spotify versions

export interface PlayerEvent {
  type?: string;
  data?: unknown;
}

export type PlayerEventName = "songchange" | "onprogress" | "onplaypause";
export type PlayerListener = (event?: PlayerEvent) => void;

export interface PlayerLike {
  data?: unknown;
  addEventListener?(type: PlayerEventName, listener: PlayerListener): void;
  removeEventListener?(type: PlayerEventName, listener: PlayerListener): void;
  getProgress?(): number;
  getDuration?(): number;
  isPlaying?(): boolean;
  togglePlay?(): void;
  next?(): void;
  back?(): void;
  seek?(position: number): void;
}

export interface SpicetifyLike {
  Player?: PlayerLike;
  getAudioData?(uri?: string): Promise<unknown>;
  CosmosAsync?: { get?(url: string): Promise<unknown> };
  Config?: { version?: string };
  Platform?: { version?: string; ClipboardAPI?: { copy?(text: string): unknown } };
  React?: { version?: string };
}

export function getSpicetify(): SpicetifyLike | undefined {
  return (globalThis as { Spicetify?: SpicetifyLike }).Spicetify;
}
