"use client";

import { useSyncExternalStore } from "react";

const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function subscribe(cb: () => void) {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
}
// Snapshot changes once per second (stable within a second, as required by useSyncExternalStore).
const getSnapshot = () => Math.floor(Date.now() / 1000);

/** A ticking UK clock - static screenshots of this page are easy to spot. */
export function LiveClock() {
  const now = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return (
    <span className="font-mono text-sm font-bold tabular-nums text-[#0f1b2d]" aria-label="Current UK time">
      {now ? fmt.format(new Date(now * 1000)) : "--:--:--"}
    </span>
  );
}
