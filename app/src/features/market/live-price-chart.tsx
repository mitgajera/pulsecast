"use client";

import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  LineType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { marketHistorySchema, oracleSampleSchema } from "@pulsecast/shared";
import { useEffect, useRef, useState } from "react";

import { mergeOracleHistory, mergeOracleSamples, toSecondChartPoints, type OracleSample } from "./oracle-sample";

type LivePriceChartProps = {
  initialSamples: OracleSample[];
  openAt: number;
  resolveAt: number;
  source: "fixture" | "magicblock";
};

const currency = new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" });

export default function LivePriceChart({ initialSamples, openAt, resolveAt, source }: LivePriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const samplesRef = useRef(initialSamples);
  const pendingRef = useRef<OracleSample | null>(null);
  const frameRef = useRef(0);
  const [latest, setLatest] = useState(initialSamples.at(-1));
  const [following, setFollowing] = useState(true);
  const [feedState, setFeedState] = useState<"live" | "reconnecting">("live");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const styles = getComputedStyle(document.documentElement);
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        attributionLogo: false,
        background: { color: "transparent", type: ColorType.Solid },
        textColor: styles.getPropertyValue("--chart-canvas-muted").trim(),
        fontFamily: "var(--font-geist-mono)",
        fontSize: 11,
      },
      crosshair: { mode: CrosshairMode.Hidden },
      grid: {
        horzLines: { visible: false },
        vertLines: { visible: false },
      },
      handleScale: { axisDoubleClickReset: true, mouseWheel: true, pinch: true },
      handleScroll: { horzTouchDrag: true, mouseWheel: true, pressedMouseMove: true, vertTouchDrag: false },
      leftPriceScale: { visible: false },
      rightPriceScale: { borderVisible: false, scaleMargins: { bottom: 0.18, top: 0.2 } },
      timeScale: { borderVisible: false, rightOffset: 12, secondsVisible: true, timeVisible: true },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: styles.getPropertyValue("--chart-canvas-primary").trim(),
      lineType: LineType.Curved,
      lineWidth: 2,
      priceLineVisible: false,
      topColor: styles.getPropertyValue("--chart-canvas-primary-fill").trim(),
      bottomColor: "transparent",
      priceFormat: { minMove: 0.01, precision: 2, type: "price" },
    });
    series.setData(toSecondChartPoints(initialSamples).map((point) => ({ ...point, time: point.time as UTCTimestamp })));
    chart.timeScale().setVisibleRange({ from: (openAt - 90) as UTCTimestamp, to: (resolveAt + 20) as UTCTimestamp });
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      setFollowing(chart.timeScale().scrollPosition() >= -14);
    });
    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      cancelAnimationFrame(frameRef.current);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [initialSamples, openAt, resolveAt]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function queueSample(sample: OracleSample) {
      if (document.hidden) return;
      pendingRef.current = sample;
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        const sample = pendingRef.current;
        if (!sample) return;
        pendingRef.current = null;
        samplesRef.current = mergeOracleSamples(samplesRef.current, sample);
        seriesRef.current?.update({ time: Math.floor(sample.sourceTimestampMs / 1_000) as UTCTimestamp, value: sample.price });
        setLatest(sample);
        if (following && !reducedMotion) chartRef.current?.timeScale().scrollToRealTime();
      });
    }

    if (source === "magicblock") {
      const stream = new EventSource(`/api/markets/${openAt}/stream`);
      const onPrice = (event: Event) => {
        if (!(event instanceof MessageEvent)) return;
        try {
          const parsed = oracleSampleSchema.safeParse(JSON.parse(String(event.data)));
          if (parsed.success) queueSample(parsed.data);
        } catch {
          setFeedState("reconnecting");
        }
      };
      stream.addEventListener("price", onPrice);
      stream.onopen = () => setFeedState("live");
      stream.onerror = () => setFeedState("reconnecting");
      return () => stream.close();
    }

  }, [following, openAt, source]);

  useEffect(() => {
    const controller = new AbortController();

    async function reconcile() {
      try {
        const response = await fetch(`/api/markets/${openAt}/history`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("History request failed");
        const parsed = marketHistorySchema.parse(await response.json());
        const previousLength = samplesRef.current.length;
        const merged = mergeOracleHistory(samplesRef.current, parsed.samples);
        samplesRef.current = merged;
        for (const sample of merged.slice(previousLength)) {
          seriesRef.current?.update({ time: Math.floor(sample.sourceTimestampMs / 1_000) as UTCTimestamp, value: sample.price });
        }
        const newest = merged.at(-1);
        if (newest) setLatest(newest);
        setFeedState("live");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFeedState("reconnecting");
      }
    }

    const interval = window.setInterval(reconcile, 5_000);
    const onVisibility = () => { if (!document.hidden) void reconcile(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [openAt]);

  function returnToLive() {
    chartRef.current?.timeScale().scrollToRealTime();
    setFollowing(true);
  }

  return (
    <div className="relative h-full min-h-[280px] sm:min-h-[360px]">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-4 sm:inset-x-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">BTC / USD</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums sm:text-3xl">{latest ? currency.format(latest.price) : "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{source === "magicblock" ? "MagicBlock oracle · 50ms" : "Oracle feed unavailable"}</p>
        </div>
        <p className="border bg-card/90 px-2 py-1 text-xs text-muted-foreground">{feedState === "live" ? "Live" : "Reconnecting"}</p>
      </div>
      <div className="absolute inset-0" ref={containerRef} aria-label="Interactive Bitcoin price chart" role="img" />
      {!following && <button className="absolute bottom-10 right-16 z-20 min-h-10 border bg-card px-3 text-xs font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={returnToLive} type="button">Return to live</button>}
      <p className="sr-only" aria-live="off">Current price {latest ? currency.format(latest.price) : "unavailable"}. Opening, betting lock, and resolution markers are shown.</p>
    </div>
  );
}
