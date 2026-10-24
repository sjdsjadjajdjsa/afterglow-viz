import React, { useLayoutEffect, useState } from "react";
import { Controls } from "../controls/Controls";
import { useSettings } from "../controls/useSettings";
import { Diagnostics } from "../diagnostics/Diagnostics";
import { PlayerClock } from "../player/clock";
import { AnalysisSource } from "../reactivity/analysis";
import { Reactor } from "../reactivity/reactor";
import { getSpicetify } from "../spicetify";
import css from "./app.css";
import { useStyle } from "./useStyle";
import { Visualizer } from "./Visualizer";

function fetchAnalysis(uri: string): Promise<unknown> {
  const S = getSpicetify();
  if (typeof S?.getAudioData !== "function") return Promise.reject(new Error("no getAudioData"));
  return S.getAudioData(uri);
}

export function App() {
  const [{ clock, reactor }] = useState(() => ({
    clock: new PlayerClock(getSpicetify()?.Player),
    reactor: new Reactor(new AnalysisSource(fetchAnalysis)),
  }));
  const [settings, setSettings] = useSettings();
  const [view, setView] = useState<"viz" | "diagnostics">("viz");
  useStyle(css);

  // layout effect so the clock has the track before child effects run
  useLayoutEffect(() => {
    let uri: string | null | undefined;
    const syncTrack = () => {
      if (clock.track?.uri === uri) return;
      uri = clock.track?.uri;
      reactor.setTrack(clock.track);
    };
    const unsubscribe = clock.subscribe(syncTrack);
    clock.start();
    return () => {
      unsubscribe();
      clock.stop();
    };
  }, [clock, reactor]);

  if (view === "diagnostics") return <Diagnostics clock={clock} reactor={reactor} onBack={() => setView("viz")} />;
  return (
    <Visualizer clock={clock} reactor={reactor} settings={settings}>
      <Controls clock={clock} settings={settings} setSettings={setSettings} onDiagnostics={() => setView("diagnostics")} />
    </Visualizer>
  );
}
