"use client";

import { useEffect, useState } from "react";

type LocalMarketTimeProps = {
  unixSeconds: number;
  variant?: "clock" | "date-time";
};

export function LocalMarketTime({ unixSeconds, variant = "clock" }: LocalMarketTimeProps) {
  const [label, setLabel] = useState(variant === "clock" ? "--:--:--" : "--- --, --:--");
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => {
    const instant = new Date(unixSeconds * 1_000);
    const options: Intl.DateTimeFormatOptions = variant === "clock"
      ? { hour: "2-digit", hour12: false, minute: "2-digit", second: "2-digit" }
      : { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" };

    setLabel(new Intl.DateTimeFormat(undefined, options).format(instant));
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [unixSeconds, variant]);

  return (
    <time dateTime={new Date(unixSeconds * 1_000).toISOString()} title={timeZone || undefined}>
      {label}
    </time>
  );
}
