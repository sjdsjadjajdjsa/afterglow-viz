import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerClock } from "../player/clock";
import type { Reactor } from "../reactivity/reactor";
import { getSpicetify } from "../spicetify";
import { EventLog, probe, testCapture, type Check, type ProbeResult } from "./probe";
import { SignalMonitor } from "./SignalMonitor";

interface Props {
  clock: PlayerClock;
  reactor: Reactor;
}

type CopyState = "idle" | "copied" | "failed";

export function Diagnostics({ clock, reactor }: Props) {
  const [eventLog] = useState(() => new EventLog(getSpicetify()?.Player));
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [capture, setCapture] = useState<Check | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [reportText, setReportText] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [, setTick] = useState(0);
  const reportRef = useRef<HTMLDetailsElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const buildReport = useCallback(
    (r: ProbeResult | null, c: Check | null) =>
      r ? JSON.stringify({ app: "afterglow-viz", ...r, events: eventLog.snapshot(), captureTest: c }, null, 2) : "",
    [eventLog],
  );

  const latestRun = useRef(0);
  const run = useCallback(async () => {
    const id = ++latestRun.current;
    setRunning(true);
    const r = await probe(getSpicetify());
    if (id !== latestRun.current) return;
    console.info("[afterglow-viz] diagnostics", r);
    setResult(r);
    setRunning(false);
  }, []);

  useEffect(() => {
    eventLog.start();
    const timer = setInterval(() => setTick((n) => n + 1), 500);
    return () => {
      clearInterval(timer);
      eventLog.stop();
    };
  }, [eventLog]);

  useEffect(() => {
    let uri = clock.track?.uri;
    run();
    return clock.subscribe(() => {
      if (clock.track?.uri === uri) return;
      uri = clock.track?.uri;
      run();
    });
  }, [clock, run]);

  useEffect(() => {
    setReportText(buildReport(result, capture));
  }, [result, capture, buildReport]);

  const runCapture = async () => {
    setCapturing(true);
    setCapture(await testCapture());
    setCapturing(false);
  };

  const copy = async () => {
    const text = buildReport(result, capture);
    setReportText(text);
    const ok = await copyText(text);
    setCopyState(ok ? "copied" : "failed");
    if (!ok && reportRef.current && textRef.current) {
      reportRef.current.open = true;
      textRef.current.focus();
      textRef.current.select();
    }
    setTimeout(() => setCopyState("idle"), 2000);
  };

  const events = eventLog.snapshot();

  return (
    <div className="agv-diag">
      <header className="agv-head">
        <h1>afterglow-viz diagnostics</h1>
        <div className="agv-actions">
          <button className="agv-btn" onClick={run} disabled={running}>
            {running ? "Checking..." : "Run again"}
          </button>
          <button className="agv-btn agv-btn-primary" onClick={copy} disabled={!result}>
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Select and copy below" : "Copy report"}
          </button>
        </div>
      </header>
      <p className="agv-hint">Play a song, skip to the next one, pause and play once, then copy the report.</p>

      <SignalMonitor clock={clock} reactor={reactor} />

      <section className="agv-card">
        <table className="agv-table">
          <tbody>
            {(result?.checks ?? []).map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
            <CheckRow
              check={capture ?? { id: "capture-test", label: "Live capture test", detail: "May ask to share your screen. Only the audio is measured." }}
              action={
                <button className="agv-btn agv-btn-small" onClick={runCapture} disabled={capturing}>
                  {capturing ? "Testing..." : "Test"}
                </button>
              }
            />
          </tbody>
        </table>
      </section>

      <section className="agv-card">
        <table className="agv-table">
          <tbody>
            {Object.entries(events).map(([name, stats]) => (
              <tr key={name}>
                <td className="agv-label">{name}</td>
                <td className="agv-num">{stats.count}</td>
                <td className="agv-detail">{stats.everyMs !== null ? `every ${stats.everyMs} ms` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <details className="agv-card" ref={reportRef}>
        <summary>Report</summary>
        <textarea ref={textRef} className="agv-report" readOnly value={reportText} spellCheck={false} />
      </details>
    </div>
  );
}

function CheckRow({ check, action }: { check: Omit<Check, "status"> & { status?: Check["status"] }; action?: React.ReactNode }) {
  return (
    <tr>
      <td className="agv-label">{check.label}</td>
      <td>{check.status && <span className={`agv-pill agv-pill-${check.status}`}>{check.status}</span>}</td>
      <td className="agv-detail">
        {check.detail}
        {check.ms !== undefined && <span className="agv-ms"> {check.ms} ms</span>}
      </td>
      <td className="agv-action">{action}</td>
    </tr>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const clipboard = getSpicetify()?.Platform?.ClipboardAPI;
    if (typeof clipboard?.copy !== "function") return false;
    try {
      await clipboard.copy(text);
      return true;
    } catch {
      return false;
    }
  }
}
