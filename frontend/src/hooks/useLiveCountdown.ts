import { useEffect, useState } from "react";
import { formatSubscriptionCountdown } from "../pages/platform/platformUi";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

function splitCountdown(endIso: string | null, nowMs: number): CountdownParts | null {
  if (endIso == null || endIso.trim() === "") return null;
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return null;
  const totalMs = Math.max(0, end - nowMs);
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalMs };
}

export function useLiveCountdown(endIso: string | null): {
  parts: CountdownParts | null;
  label: string | null;
} {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (endIso == null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endIso]);

  const parts = splitCountdown(endIso, nowMs);
  const label =
    parts != null ? formatSubscriptionCountdown(parts.totalMs) : null;

  return { parts, label };
}
