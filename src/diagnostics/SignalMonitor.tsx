import React, { useEffect, useRef } from "react";
import type { PlayerClock } from "../player/clock";
import type { Reactor } from "../reactivity/reactor";
import type { ReactiveFrame } from "../reactivity/types";
import { formatTime } from "../util/time";

interface Props {
  clock: PlayerClock;
  reactor: Reactor;
}

export function SignalMonitor({ clock, reactor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const styles = getComputedStyle(canvas);
    const accent = styles.getPropertyValue("--spice-button").trim() || "#1ed760";
    const text = styles.getPropertyValue("--spice-text").trim() || "#ffffff";
    let raf = 0;
    let last = performance.now();
    let info = "";

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const position = clock.positionMs();
      const frame = reactor.update(position, clock.playing, now - last);
      last = now;
      fitToDisplay(canvas);
      paint(ctx, canvas.width, canvas.height, frame, accent, text);

      const duration = clock.track?.durationMs ?? 0;
      const next = `${reactor.kind}  ${clock.playing ? "playing" : "paused"}  ${formatTime(position)} / ${formatTime(duration)}`;
      if (next !== info && infoRef.current) infoRef.current.textContent = info = next;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, reactor]);

  return (
    <div className="agv-monitor">
      <canvas ref={canvasRef} />
      <div ref={infoRef} className="agv-monitor-info" />
    </div>
  );
}

function fitToDisplay(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, frame: ReactiveFrame, accent: string, text: string): void {
  const dpr = window.devicePixelRatio || 1;
  const pad = 16 * dpr;
  const ringBox = Math.min(h, w * 0.3);
  const barsWidth = w - ringBox - pad * 2;
  const n = frame.bands.length;
  const slot = barsWidth / n;
  const barHeight = h - pad * 2 - 20 * dpr;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = accent;
  for (let i = 0; i < n; i++) {
    const v = frame.bands[i];
    const bh = Math.max(2 * dpr, v * barHeight);
    ctx.globalAlpha = 0.35 + 0.65 * v;
    ctx.fillRect(pad + i * slot, h - pad - bh, slot * 0.7, bh);
  }

  const cx = w - pad - ringBox / 2;
  const cy = h / 2;
  const r = ringBox * (0.2 + 0.1 * frame.level + 0.12 * frame.beat);
  ctx.globalAlpha = 0.3 + 0.7 * frame.beat;
  ctx.strokeStyle = accent;
  ctx.lineWidth = (2 + 6 * frame.beat) * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.15 + 0.6 * frame.level;
  ctx.fillStyle = text;
  ctx.beginPath();
  ctx.arc(cx, cy, r * (0.2 + 0.4 * frame.level), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
