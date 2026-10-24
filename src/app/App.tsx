import React, { useLayoutEffect, useState } from "react";
import { Diagnostics } from "../diagnostics/Diagnostics";
import { PlayerClock } from "../player/clock";
import { Reactor } from "../reactivity/reactor";
import { SynthSource } from "../reactivity/synth";
import { getSpicetify } from "../spicetify";
import css from "./app.css";
import { useStyle } from "./useStyle";

export function App() {
  const [{ clock, reactor }] = useState(() => ({
    clock: new PlayerClock(getSpicetify()?.Player),
    reactor: new Reactor(new SynthSource()),
  }));
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

  return <Diagnostics clock={clock} reactor={reactor} />;
}
