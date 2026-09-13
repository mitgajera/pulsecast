"use client";

import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  LineStyle,
  LineType,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { marketHistorySchema, oracleSampleSchema } from "@pulsecast/shared";
import { useEffect, useRef, useState } from "react";

import { usePulseCastAuth } from "@/features/auth/auth-context";
import { mergeOracleHistory, mergeOracleSamples, toChartPoints, type OracleSample } from "./oracle-sample";
import { loadPredictionMarker, PREDICTION_MARKER_EVENT, type PredictionMarker } from "./prediction-marker";

type LivePriceChartProps = {
  initialSamples: OracleSample[];
  openAt: number;
  roundId: string;
  source: "fixture" | "magicblock";
};

const currency = new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" });
const WINDOW_SECONDS = 90;
const FUTURE_PADDING_SECONDS = 4;

function chartTime(sourceTimestampMs: number) {
  return (sourceTimestampMs / 1_000) as UTCTimestamp;
}

export default function LivePriceChart({ initialSamples, openAt, roundId, source }: LivePriceChartProps) {
  const auth = usePulseCastAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const predictionLineRef = useRef<IPriceLine | null>(null);
  const bootstrapSamplesRef = useRef(initialSamples);
  const samplesRef = useRef(initialSamples);
  const pendingRef = useRef<OracleSample | null>(null);
  const frameRef = useRef(0);
  const followingRef = useRef(true);
  const lastViewportUpdateRef = useRef(0);
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
      rightPriceScale: {
        autoScale: true,
        borderVisible: false,
        minimumWidth: 72,
        scaleMargins: { bottom: 0.14, top: 0.18 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        rightOffset: 4,
        secondsVisible: true,
        timeVisible: true,
      },
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
    series.priceScale().applyOptions({ autoScale: true });
    const bootstrapSamples = bootstrapSamplesRef.current;
    series.setData(toChartPoints(bootstrapSamples).map((point) => ({ ...point, time: point.time as UTCTimestamp })));
    const latestTime = (bootstrapSamples.at(-1)?.sourceTimestampMs ?? openAt * 1_000) / 1_000;
    chart.timeScale().setVisibleRange({
      from: (latestTime - WINDOW_SECONDS) as UTCTimestamp,
      to: (latestTime + FUTURE_PADDING_SECONDS) as UTCTimestamp,
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const nextFollowing = chart.timeScale().scrollPosition() >= -14;
      followingRef.current = nextFollowing;
      setFollowing(nextFollowing);
    });
    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      cancelAnimationFrame(frameRef.current);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [openAt]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !auth.address) return;

    const markerColor = getComputedStyle(document.documentElement).getPropertyValue("--chart-canvas-prediction").trim();
    function showMarker(price: number) {
      if (predictionLineRef.current) series!.removePriceLine(predictionLineRef.current);
      predictionLineRef.current = series!.createPriceLine({
        axisLabelVisible: true,
        color: markerColor,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        price,
        title: "Your prediction",
      });
    }

    const saved = loadPredictionMarker(auth.address, roundId);
    if (saved !== null) showMarker(saved);
    const onMarker = (event: Event) => {
      const marker = (event as CustomEvent<PredictionMarker>).detail;
      if (marker.wallet === auth.address && marker.roundId === roundId) showMarker(marker.price);
    };
    window.addEventListener(PREDICTION_MARKER_EVENT, onMarker);
    return () => window.removeEventListener(PREDICTION_MARKER_EVENT, onMarker);
  }, [auth.address, roundId]);

  useEffect(() => {
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
        seriesRef.current?.update({ time: chartTime(sample.sourceTimestampMs), value: sample.price });
        setLatest(sample);
        if (followingRef.current && performance.now() - lastViewportUpdateRef.current >= 250) {
          lastViewportUpdateRef.current = performance.now();
          const time = sample.sourceTimestampMs / 1_000;
          chartRef.current?.timeScale().setVisibleRange({
            from: (time - WINDOW_SECONDS) as UTCTimestamp,
            to: (time + FUTURE_PADDING_SECONDS) as UTCTimestamp,
          });
        }
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

  }, [openAt, source]);

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
          seriesRef.current?.update({ time: chartTime(sample.sourceTimestampMs), value: sample.price });
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
    followingRef.current = true;
    setFollowing(true);
  }

  return (
    <div className="relative h-full min-h-[280px] sm:min-h-[340px] lg:min-h-0">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-4 sm:inset-x-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">BTC / USD</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums sm:text-3xl">{latest ? currency.format(latest.price) : "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{source === "magicblock" ? "MagicBlock oracle · 50ms" : "Oracle feed unavailable"}</p>
        </div>
        <p className="border bg-card/90 px-2 py-1 text-xs text-muted-foreground">{feedState === "live" ? "Live" : "Reconnecting"}</p>
      </div>
      <div className="absolute inset-0" ref={containerRef} aria-label="Interactive Bitcoin price chart" role="img" />
      {!latest && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
          <div>
            <p className="font-medium">Connecting to the BTC feed</p>
            <p className="mt-1 text-sm text-muted-foreground">Price history will appear automatically.</p>
          </div>
        </div>
      )}
      {!following && <button className="absolute bottom-10 right-16 z-20 min-h-10 border bg-card px-3 text-xs font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={returnToLive} type="button">Return to live</button>}
      <p className="sr-only" aria-live="off">Current price {latest ? currency.format(latest.price) : "unavailable"}. Opening, betting lock, and resolution markers are shown.</p>
    </div>
  );
}
