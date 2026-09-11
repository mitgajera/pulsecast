import { describe, expect, it } from "vitest";

import { prepareOperationSchema, preparedOperationSchema } from "./operation";

const base = {
  idempotencyKey: "0191d6ae-0ab8-7dc4-a79a-8f315d6c17d2",
  roundId: "42",
  wallet: "414exgwxaeBSjajy42RKbmRqKn6o8YesDkGFwnxZNgvn",
};

describe("prepareOperationSchema", () => {
  it("accepts a price only for prediction setup", () => {
    expect(
      prepareOperationSchema.parse({
        ...base,
        action: "setup_prediction",
        predictedPrice: "11292000000000",
      }),
    ).toMatchObject({ action: "setup_prediction" });
  });

  it("rejects arbitrary transaction fields", () => {
    const result = prepareOperationSchema.safeParse({
      ...base,
      action: "enter_market",
      predictedPrice: "11292000000000",
      transaction: "attacker-controlled-bytes",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("transaction");
  });

  it("rejects non-atomic prediction prices", () => {
    expect(
      prepareOperationSchema.safeParse({
        ...base,
        action: "setup_prediction",
        predictedPrice: "112920.00",
      }).success,
    ).toBe(false);
  });
});

describe("preparedOperationSchema", () => {
  it("requires a short-lived signing response shape", () => {
    expect(
      preparedOperationSchema.safeParse({
        expiresAt: Date.now() + 30_000,
        operationId: "0191d6ae-0ab8-7dc4-a79a-8f315d6c17d2",
        state: "awaiting_signature",
        transaction: "AQABAA==",
      }).success,
    ).toBe(true);
  });
});
