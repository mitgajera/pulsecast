"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function MarketAutoRefresh({ resolveAt }: { resolveAt: number | null }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    const heartbeat = window.setInterval(refresh, 10_000);
    const boundaryDelay = resolveAt === null ? null : Math.max(0, resolveAt * 1_000 - Date.now() + 500);
    const boundary = boundaryDelay === null ? null : window.setTimeout(refresh, boundaryDelay);
    return () => {
      window.clearInterval(heartbeat);
      if (boundary !== null) window.clearTimeout(boundary);
    };
  }, [resolveAt, router]);

  return null;
}
