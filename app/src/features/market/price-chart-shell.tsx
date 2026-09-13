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
  roundId: string;
  source: "fixture" | "magicblock";
};

export function PriceChartShell(props: PriceChartShellProps) {
  return (
    <section className="relative min-h-[300px] overflow-hidden bg-card sm:min-h-[360px] lg:min-h-0 lg:flex-1" aria-label="BTC price chart">
      <LivePriceChart key={props.openAt} {...props} />
    </section>
  );
}

function ChartSkeleton() {
  return (
    <div className="min-h-[300px] animate-pulse p-6 sm:min-h-[360px] lg:h-full lg:min-h-0" aria-label="Loading price chart">
      <div className="h-3 w-20 bg-muted" />
      <div className="mt-3 h-8 w-48 bg-muted" />
      <div className="mt-16 h-px w-full bg-muted" />
      <div className="mt-16 h-px w-full bg-muted" />
    </div>
  );
}
