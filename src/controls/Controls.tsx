import React, { useEffect, useRef, useState } from "react";
import { useStyle } from "../app/useStyle";
import type { PlayerClock } from "../player/clock";
import type { NowPlaying } from "../player/nowPlaying";
import type { Settings } from "../settings";
import { getSpicetify, type PlayerLike } from "../spicetify";
import { attempt } from "../util/read";
import css from "./controls.css";
import { Icon } from "./icons";
import { Panel } from "./Panel";
import { useFullscreen } from "./useFullscreen";
import type { Presets } from "./usePresets";
import type { SetSettings } from "./useSettings";

export interface ControlsProps {
  settings: Settings;
  setSettings: SetSettings;
  // false when settings or presets couldn't be saved
  stored: boolean;
  presets: Presets;
  onDiagnostics: () => void;
  clock?: PlayerClock;
  full: boolean;
  setFull: (full: boolean) => void;
}

export function Controls({ settings, setSettings, stored, presets, onDiagnostics, clock, full, setFull }: ControlsProps) {
  useStyle(css);
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { toggle } = useFullscreen(ref, full, setFull, open);
  const { track, playing } = useNowPlaying(clock);

  useEffect(() => {
    if (!open || full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, full]);

  const player = getSpicetify()?.Player;

  return (
    <div ref={ref} className={"agv-ui" + (open ? " agv-ui-open" : "")}>
      {open && <Panel settings={settings} setSettings={setSettings} stored={stored} presets={presets} onClose={() => setOpen(false)} onDiagnostics={onDiagnostics} />}
      <div className="agv-bar">
        <div className="agv-now">
          {track && (
            <>
              <strong title={track.title}>{track.title}</strong>
              {track.artist && <span title={track.artist}>{track.artist}</span>}
            </>
          )}
        </div>
        <div className="agv-transport">
          <PlayerButton player={player} method="back" label="Previous" icon="prev" />
          <PlayerButton player={player} method="togglePlay" label={playing ? "Pause" : "Play"} icon={playing ? "pause" : "play"} primary />
          <PlayerButton player={player} method="next" label="Next" icon="next" />
        </div>
        <div className="agv-tools">
          <button
            className={"agv-icon-btn" + (open ? " agv-on" : "")}
            aria-label="Customize"
            aria-pressed={open}
            title="Customize"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name="customize" />
          </button>
          <button className="agv-icon-btn" aria-label={full ? "Exit full view" : "Full view"} title={full ? "Exit full view (Esc)" : "Full view"} onClick={toggle}>
            <Icon name={full ? "exit-full" : "enter-full"} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface PlayerButtonProps {
  player: PlayerLike | undefined;
  method: "back" | "togglePlay" | "next";
  label: string;
  icon: "prev" | "next" | "play" | "pause";
  primary?: boolean;
}

function PlayerButton({ player, method, label, icon, primary }: PlayerButtonProps) {
  const usable = typeof player?.[method] === "function";
  return (
    <button
      className={primary ? "agv-play" : "agv-icon-btn"}
      aria-label={label}
      title={label}
      disabled={!usable}
      onClick={() => attempt(() => player?.[method]?.(), undefined)}
    >
      <Icon name={icon} />
    </button>
  );
}

function useNowPlaying(clock: PlayerClock | undefined): { track: NowPlaying | null; playing: boolean } {
  const read = () => ({ track: clock?.track ?? null, playing: clock?.playing ?? false });
  const [state, setState] = useState(read);
  useEffect(() => {
    if (!clock) return;
    const sync = () => setState({ track: clock.track, playing: clock.playing });
    sync();
    return clock.subscribe(sync);
  }, [clock]);
  return state;
}
