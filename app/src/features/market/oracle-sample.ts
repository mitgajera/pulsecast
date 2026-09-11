import type { OracleSample } from "@pulsecast/shared";

export type { OracleSample } from "@pulsecast/shared";

export function toSecondChartPoints(samples: OracleSample[]) {
  const points: Array<{ time: number; value: number }> = [];
  for (const sample of samples) {
    const point = { time: Math.floor(sample.sourceTimestampMs / 1_000), value: sample.price };
    if (points.at(-1)?.time === point.time) points[points.length - 1] = point;
    else points.push(point);
  }
  return points;
}

export function createOracleHistory(openAt: number, endTimeMs = openAt * 1_000): OracleSample[] {
  const startMs = (openAt - 90) * 1_000;
  const boundedEndMs = Math.min(Math.max(endTimeMs, startMs), (openAt + 70) * 1_000);
  const count = Math.floor((boundedEndMs - startMs) / 500) + 1;
  return Array.from({ length: count }, (_, index) => {
    const sourceTimestampMs = startMs + index * 500;
    return {
      price: fixturePriceAt(sourceTimestampMs, openAt),
      sourceTimestampMs,
      slot: 410_000_000 + index,
    };
  });
}

export function nextFixtureSample(previous: OracleSample, nowMs: number, openAt: number): OracleSample {
  return {
    price: fixturePriceAt(nowMs, openAt),
    sourceTimestampMs: nowMs,
    slot: previous.slot + 1,
  };
}

function fixturePriceAt(timestampMs: number, openAt: number) {
  const index = (timestampMs - (openAt - 90) * 1_000) / 500;
  const trend = index * 0.48;
  const movement = Math.sin(index / 5) * 11 + Math.sin(index / 13) * 6;
  return Number((112_790 + trend + movement).toFixed(2));
}

export function mergeOracleSamples(current: OracleSample[], incoming: OracleSample) {
  const latest = current.at(-1);
  if (
    latest &&
    (incoming.sourceTimestampMs < latest.sourceTimestampMs ||
      (incoming.sourceTimestampMs === latest.sourceTimestampMs && incoming.slot <= latest.slot))
  ) return current;
  const next = [...current, incoming];
  return next.slice(-1_200);
}

export function mergeOracleHistory(current: OracleSample[], incoming: OracleSample[]) {
  return incoming.reduce(mergeOracleSamples, current);
}
