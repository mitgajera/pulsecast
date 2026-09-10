import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { marketHistorySchema, oracleSampleSchema, type OracleSample } from "@pulsecast/shared";

import type { CollectorConfig } from "./config.js";
import type { SampleBuffer } from "./sample-buffer.js";

const maxStreamClients = 100;

export type CollectorSource = {
  buffer: Pick<SampleBuffer, "history">;
  health: () => unknown;
  subscribe: (listener: (sample: OracleSample) => void) => () => boolean | void;
};

export function createCollectorServer(collector: CollectorSource, config: CollectorConfig): Server {
  const clients = new Set<ServerResponse>();
  const unsubscribe = collector.subscribe((sample) => broadcast(clients, sample));

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    applyCors(request.headers.origin, response, config.allowedOrigin);

    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    if (url.pathname === "/health") {
      sendJson(response, 200, collector.health());
      return;
    }
    if (url.pathname === "/v1/history") {
      const roundId = parseRoundId(url.searchParams.get("roundId"));
      if (roundId === null) {
        sendJson(response, 400, { error: "A minute-aligned roundId is required." });
        return;
      }
      const payload = marketHistorySchema.parse({
        roundId: String(roundId),
        samples: collector.buffer.history((roundId - 90) * 1_000),
        serverTimeMs: Date.now(),
        source: "magicblock",
      });
      response.setHeader("Cache-Control", "private, no-store");
      sendJson(response, 200, payload);
      return;
    }
    if (url.pathname === "/v1/stream") {
      if (clients.size >= maxStreamClients) {
        sendJson(response, 503, { error: "Stream capacity reached." });
        return;
      }
      response.writeHead(200, {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      });
      response.write("retry: 1000\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }
    sendJson(response, 404, { error: "Not found." });
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) client.write(": heartbeat\n\n");
  }, 15_000);

  server.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    for (const client of clients) client.end();
    clients.clear();
  });
  return server;
}

export function serverAddress(server: Server) {
  const address = server.address() as AddressInfo | null;
  return address ? `http://${address.address}:${address.port}` : null;
}

function broadcast(clients: Set<ServerResponse>, sample: OracleSample) {
  const payload = JSON.stringify(oracleSampleSchema.parse(sample));
  for (const client of clients) client.write(`event: price\ndata: ${payload}\n\n`);
}

function applyCors(origin: string | undefined, response: ServerResponse, allowedOrigin: string) {
  if (origin === allowedOrigin) response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Vary", "Origin");
}

function parseRoundId(value: string | null) {
  if (value === null || !/^\d+$/.test(value)) return null;
  const roundId = Number(value);
  return Number.isSafeInteger(roundId) && roundId % 60 === 0 ? roundId : null;
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}
