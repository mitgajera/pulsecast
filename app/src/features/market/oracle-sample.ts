export type OracleSample = {
  price: number;
  sourceTimestampMs: number;
  slot: number;
};

export function createOracleHistory(openAt: number): OracleSample[] {
  const startMs = (openAt - 90) * 1_000;
  return Array.from({ length: 181 }, (_, index) => {
    const sourceTimestampMs = startMs + index * 500;
    const trend = index * 0.48;
    const movement = Math.sin(index / 5) * 11 + Math.sin(index / 13) * 6;
    return {
      price: Number((112_790 + trend + movement).toFixed(2)),
      sourceTimestampMs,
      slot: 410_000_000 + index,
    };
  });
}

export function nextFixtureSample(previous: OracleSample, nowMs: number): OracleSample {
  const wave = Math.sin(nowMs / 1_900) * 2.8 + Math.sin(nowMs / 730) * 1.2;
  return {
    price: Number((previous.price + wave).toFixed(2)),
    sourceTimestampMs: nowMs,
    slot: previous.slot + 1,
  };
}

export function mergeOracleSamples(current: OracleSample[], incoming: OracleSample) {
  const latest = current.at(-1);
  if (latest && incoming.sourceTimestampMs <= latest.sourceTimestampMs) return current;
  const next = [...current, incoming];
  return next.slice(-1_200);
}
