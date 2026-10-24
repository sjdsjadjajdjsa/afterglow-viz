import React from "react";

type Name = "prev" | "next" | "play" | "pause" | "customize" | "enter-full" | "exit-full" | "close";

const FILLED: Partial<Record<Name, string>> = {
  prev: "M3 2h2v12H3zM14 2.5v11L6 8z",
  next: "M11 2h2v12h-2zM2 2.5v11L10 8z",
  play: "M4.5 2.2v11.6L13.8 8z",
  pause: "M3.5 2h3v12h-3zM9.5 2h3v12h-3z",
};

const STROKED: Partial<Record<Name, string>> = {
  "enter-full": "M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4",
  "exit-full": "M6 2v4H2M10 2v4h4M14 10h-4v4M2 10h4v4",
  close: "M3.5 3.5l9 9M12.5 3.5l-9 9",
};

export function Icon({ name }: { name: Name }) {
  if (name === "customize") {
    return (
      <svg className="agv-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1.5 4.5h13M1.5 11.5h13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="5" cy="4.5" r="2" fill="currentColor" />
        <circle cx="11" cy="11.5" r="2" fill="currentColor" />
      </svg>
    );
  }
  const filled = FILLED[name];
  return (
    <svg className="agv-icon" viewBox="0 0 16 16" aria-hidden="true">
      {filled ? (
        <path d={filled} fill="currentColor" />
      ) : (
        <path d={STROKED[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
