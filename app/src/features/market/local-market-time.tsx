"use client";

import { useSyncExternalStore } from "react";

type LocalMarketTimeProps = {
  unixSeconds: number;
  variant?: "clock" | "date-time";
};

export function LocalMarketTime({ unixSeconds, variant = "clock" }: LocalMarketTimeProps) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const instant = new Date(unixSeconds * 1_000);
  const options: Intl.DateTimeFormatOptions = variant === "clock"
    ? { hour: "2-digit", hour12: false, minute: "2-digit", second: "2-digit" }
    : { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" };
  const label = mounted
    ? new Intl.DateTimeFormat(undefined, options).format(instant)
    : variant === "clock" ? "--:--:--" : "--- --, --:--";
  const timeZone = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  return (
    <time dateTime={instant.toISOString()} title={timeZone}>
      {label}
    </time>
  );
}

function noopSubscribe() {
  return () => undefined;
}
