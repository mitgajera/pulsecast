"use client";

import dynamic from "next/dynamic";

import type { OracleSample } from "./oracle-sample";

const LivePriceChart = dynamic(() => import("./live-price-chart"), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});

type PriceChartShellProps = {
  initialSamples: OracleSample[];
  openAt: number;
  resolveAt: number;
  source: "fixture" | "magicblock";
};

export function PriceChartShell(props: PriceChartShellProps) {
  if (props.initialSamples.length === 0) {
    return (
      <section className="flex min-h-[300px] items-center justify-center bg-card px-6 text-center sm:min-h-[400px]">
        <div className="max-w-sm">
          <h2 className="font-semibold">Waiting for price history</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">The live feed is connected. Charting begins after the first oracle sample arrives.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[300px] overflow-hidden bg-card sm:min-h-[400px]" aria-label="BTC price chart">
      <LivePriceChart {...props} />
    </section>
  );
}

function ChartSkeleton() {
  return (
    <div className="min-h-[300px] animate-pulse p-6 sm:min-h-[400px]" aria-label="Loading price chart">
      <div className="h-3 w-20 bg-muted" />
      <div className="mt-3 h-8 w-48 bg-muted" />
      <div className="mt-16 h-px w-full bg-muted" />
      <div className="mt-16 h-px w-full bg-muted" />
    </div>
  );
}
