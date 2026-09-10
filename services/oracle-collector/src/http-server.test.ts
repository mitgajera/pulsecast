import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import { BTC_USD_FEED_ACCOUNT, loadCollectorConfig } from "./config.js";
import { createCollectorServer, serverAddress, type CollectorSource } from "./http-server.js";
import { SampleBuffer } from "./sample-buffer.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function startServer() {
  const buffer = new SampleBuffer();
  buffer.add({ price: 77_100, slot: 580_000_000, sourceTimestampMs: 1_800_000_000_000 });
  const collector: CollectorSource = {
    buffer,
    health: () => ({ lagMs: 10, sampleCount: 1, status: "healthy" }),
    subscribe: () => () => undefined,
  };
  const config = { ...loadCollectorConfig({}), feedAccount: BTC_USD_FEED_ACCOUNT, port: 0 };
  const server = createCollectorServer(collector, config);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return serverAddress(server)!;
}

describe("collector HTTP server", () => {
  it("serves health and validated history", async () => {
    const address = await startServer();
    expect(await fetch(`${address}/health`).then((response) => response.json())).toMatchObject({ status: "healthy" });
    const response = await fetch(`${address}/v1/history?roundId=1800000000`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ roundId: "1800000000", source: "magicblock" });
  });

  it("rejects malformed rounds and unsupported methods", async () => {
    const address = await startServer();
    expect((await fetch(`${address}/v1/history?roundId=nope`)).status).toBe(400);
    expect((await fetch(`${address}/health`, { method: "POST" })).status).toBe(405);
  });
});
