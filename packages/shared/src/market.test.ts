import { describe, expect, it } from "vitest";

import { marketScheduleSchema, phaseAt } from "./market";

const schedule = { openAt: 120, lockAt: 150, resolveAt: 180 };

describe("market schedule", () => {
  it("matches the protocol's minute boundaries", () => {
    expect(marketScheduleSchema.parse(schedule)).toEqual(schedule);
    expect(phaseAt(schedule, 119)).toBe("scheduled");
    expect(phaseAt(schedule, 120)).toBe("betting");
    expect(phaseAt(schedule, 149)).toBe("betting");
    expect(phaseAt(schedule, 150)).toBe("watching");
    expect(phaseAt(schedule, 179)).toBe("watching");
    expect(phaseAt(schedule, 180)).toBe("resolving");
  });

  it("rejects schedules that drift from 30/60 seconds", () => {
    expect(() =>
      marketScheduleSchema.parse({ openAt: 120, lockAt: 151, resolveAt: 180 }),
    ).toThrow();
  });
});
