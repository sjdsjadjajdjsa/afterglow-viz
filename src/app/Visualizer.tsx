import React, { useEffect, useRef, useState, type ReactNode } from "react";
import * as ReactDOM from "react-dom";
import type { PlayerClock } from "../player/clock";
import type { Reactor } from "../reactivity/reactor";
import { TrackAssets } from "../scene/assets";
import { Background } from "../scene/background";
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
  const bgRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [assets] = useState(() => new TrackAssets());
  useFitHeight(rootRef, full);

  // loaded whenever there is a picture, so its colors work even while the middle shows album art
  const { image } = settings.centerpiece;
  useEffect(() => {
    assets.setCenterImage(image);
  }, [assets, image]);

  useEffect(() => {
    const sync = () => assets.setNowPlaying(clock.track);
    sync();
    return clock.subscribe(sync);
  }, [assets, clock]);

  useEffect(() => {
    const background = new Background(bgRef.current!);
    const scene = new Scene(canvasRef.current!, clock, reactor, () => settingsRef.current, assets.track, createLayers(), background);
    scene.start();
    return () => {
      scene.stop();
      background.dispose();
    };
  }, [assets, clock, reactor, full]);

  const view = (
    <div ref={rootRef} className={"agv-viz" + (full ? " agv-full" : "")}>
      <div ref={bgRef} className="agv-bg" />
      <canvas ref={canvasRef} className="agv-canvas" />
      {children}
    </div>
  );
  // moved to the body while full, so nothing in spotify's page can clip it or sit on top
  const portal = (ReactDOM as { createPortal?: typeof ReactDOM.createPortal }).createPortal;
  return full && portal ? portal(view, document.body) : view;
}
