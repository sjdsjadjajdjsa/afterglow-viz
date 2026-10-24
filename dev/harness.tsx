import React, { StrictMode, useEffect, useState } from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { formatTime } from "../src/util/time";
import { createMockSpicetify, type AudioMode, type DataShape, type MockTrack } from "./mock/spicetify";

declare global {
  interface Window {
    Spicetify: unknown;
    render?: () => React.ReactElement;
  }
}

function makeArt(colors: [string, string, string]): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 512, 512);
  bg.addColorStop(0, colors[0]);
  bg.addColorStop(1, colors[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = colors[2];
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(330, 200, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillRect(60, 340, 392, 40);
  return canvas.toDataURL("image/jpeg", 0.85);
}

const tracks: MockTrack[] = [
  { uri: "spotify:track:mock0000000000000000001", title: "Low Tide Static", artist: "The Quiet Hours", album: "Harbor Lights", durationMs: 192_000, tempo: 84, energy: 0.35, art: makeArt(["#0b1d3a", "#2a6f97", "#f4a259"]) },
  { uri: "spotify:track:mock0000000000000000002", title: "Neon Orchard", artist: "Paper Satellites", album: "Night Market", durationMs: 214_000, tempo: 124, energy: 0.82, art: makeArt(["#3a0ca3", "#f72585", "#4cc9f0"]) },
  { uri: "spotify:track:mock0000000000000000003", title: "Glasshouse", artist: "Mira Vale", album: "Glasshouse", durationMs: 247_000, tempo: 100, energy: 0.55, art: makeArt(["#1b4332", "#95d5b2", "#ffd166"]) },
  { uri: "spotify:track:mock0000000000000000004", title: "Overpass Summer", artist: "Night Bus Choir", album: "Overpass Summer", durationMs: 176_000, tempo: 142, energy: 0.9, art: makeArt(["#9d0208", "#ffba08", "#03071e"]) },
  { uri: "spotify:ad:00000000000000000000001", title: "Advertisement", artist: "Spotify", album: "", durationMs: 30_000, tempo: 100, energy: 0.5, art: null },
  { uri: "spotify:local:Night+Bus+Choir:Demos:Basement+Take:131", title: "Basement Take", artist: "Night Bus Choir", album: "Demos", durationMs: 131_000, tempo: 110, energy: 0.5, art: null },
];

const { Spicetify, controls } = createMockSpicetify({ tracks, extras: { React, ReactDOM } });
window.Spicetify = Spicetify;
const player = Spicetify.Player;

const SHAPES: DataShape[] = ["current", "legacy", "sparse"];
const AUDIO: AudioMode[] = ["available", "failing", "missing"];

function Panel() {
  const [state, setState] = useState(controls.snapshot);
  useEffect(() => controls.subscribe(() => setState(controls.snapshot())), []);
  const { track, playing, positionMs, shape, audio } = state;

  return (
    <div className="harness">
      <button onClick={player.back}>Prev</button>
      <button className="harness-play" onClick={player.togglePlay}>
        {playing ? "Pause" : "Play"}
      </button>
      <button onClick={player.next}>Next</button>
      <div className="harness-track">
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </div>
      <input
        type="range"
        min={0}
        max={track.durationMs}
        step={1000}
        value={positionMs}
        onChange={(e) => player.seek(Number(e.target.value))}
      />
      <span className="harness-time">
        {formatTime(positionMs)} / {formatTime(track.durationMs)}
      </span>
      <label>
        Player.data
        <select value={shape} onChange={(e) => controls.setShape(e.target.value as DataShape)}>
          {SHAPES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Audio data
        <select value={audio} onChange={(e) => controls.setAudio(e.target.value as AudioMode)}>
          {AUDIO.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

window.addEventListener("load", () => {
  createRoot(document.getElementById("harness")!).render(<Panel />);
  const app = document.getElementById("app")!;
  if (typeof window.render !== "function") {
    app.textContent = "dist/index.js didn't load. Run npm run build or npm run dev.";
    return;
  }
  // strict mode runs effects twice, catches missing cleanup
  createRoot(app).render(<StrictMode>{React.createElement(window.render)}</StrictMode>);
});
