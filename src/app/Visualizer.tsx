import React, { useEffect, useRef, useState, type ReactNode } from "react";
import * as ReactDOM from "react-dom";
import type { PlayerClock } from "../player/clock";
import type { Reactor } from "../reactivity/reactor";
import { TrackAssets } from "../scene/assets";
import { createLayers } from "../scene/layers";
import { Scene } from "../scene/Scene";
import type { Settings } from "../settings";
import { useFitHeight } from "./useFitHeight";

interface Props {
  clock: PlayerClock;
  reactor: Reactor;
  settings: Settings;
  // fill the whole spotify window
  full?: boolean;
  children?: ReactNode;
}

export function Visualizer({ clock, reactor, settings, full = false, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [assets] = useState(() => new TrackAssets());
  useFitHeight(rootRef, full);

  const { kind, image } = settings.centerpiece;
  useEffect(() => {
    assets.setCenterImage(kind === "image" ? image : null);
  }, [assets, kind, image]);

  useEffect(() => {
    const sync = () => assets.setNowPlaying(clock.track);
    sync();
    return clock.subscribe(sync);
  }, [assets, clock]);

  useEffect(() => {
    const scene = new Scene(canvasRef.current!, clock, reactor, () => settingsRef.current, assets.track, createLayers());
    scene.start();
    return () => scene.stop();
  }, [assets, clock, reactor, full]);

  const view = (
    <div ref={rootRef} className={"agv-viz" + (full ? " agv-full" : "")}>
      <canvas ref={canvasRef} className="agv-canvas" />
      {children}
    </div>
  );
  // moved to the body while full, so nothing in spotify's page can clip it or sit on top
  const portal = (ReactDOM as { createPortal?: typeof ReactDOM.createPortal }).createPortal;
  return full && portal ? portal(view, document.body) : view;
}
