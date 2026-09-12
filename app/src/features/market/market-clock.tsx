"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MarketClockProps = {
  initialServerTimeMs: number;
  lockAt: number;
  resolveAt: number;
};

function formatRemaining(milliseconds: number) {
  const safe = Math.max(0, milliseconds);
  const seconds = Math.ceil(safe / 1_000);
  return `00:${String(seconds).padStart(2, "0")}`;
}

export function MarketClock({
  initialServerTimeMs,
  lockAt,
  resolveAt,
}: MarketClockProps) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState(initialServerTimeMs);

  useEffect(() => {
    const startedAt = performance.now();
    let frame = 0;
    let previousSecond = -1;

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const second = Math.floor(elapsed / 1_000);
      if (second !== previousSecond) {
        previousSecond = second;
        setNowMs(initialServerTimeMs + elapsed);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [initialServerTimeMs]);

  useEffect(() => {
    const delay = Math.max(0, resolveAt * 1_000 - initialServerTimeMs + 1_500);
    const refresh = window.setTimeout(() => router.refresh(), delay);
    return () => window.clearTimeout(refresh);
  }, [initialServerTimeMs, resolveAt, router]);

  const state = useMemo(() => {
    if (nowMs < lockAt * 1_000) {
      return { label: "Betting closes in", phase: "Betting", target: lockAt * 1_000 };
    }
    if (nowMs < resolveAt * 1_000) {
      return { label: "Resolution in", phase: "Watching", target: resolveAt * 1_000 };
    }
    return { label: "Awaiting oracle", phase: "Resolving", target: nowMs };
  }, [lockAt, nowMs, resolveAt]);

  return (
    <div className="flex items-end justify-between gap-4" aria-label="Market phase clock">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {state.label}
        </p>
        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
          {formatRemaining(state.target - nowMs)}
        </p>
      </div>
      <p className="mb-1 flex items-center gap-2 text-sm font-medium" aria-live="polite">
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
        {state.phase}
      </p>
    </div>
  );
}
