import { describe, expect, it } from "vitest";

import { loadCollectorConfig } from "./config.js";

describe("collector configuration", () => {
  it("uses the platform PORT before the local collector port", () => {
    expect(loadCollectorConfig({ PORT: "10000", ORACLE_COLLECTOR_PORT: "8787" }).port).toBe(10_000);
  });

  it("rejects an invalid platform port", () => {
    expect(() => loadCollectorConfig({ PORT: "0" })).toThrow("ORACLE_COLLECTOR_PORT");
  });
});
