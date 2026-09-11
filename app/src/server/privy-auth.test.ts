import { describe, expect, it } from "vitest";

import { ApiAuthError, getBearerToken, readPrivyAuthConfig } from "./privy-auth";

describe("getBearerToken", () => {
  it("extracts a bounded bearer token", () => {
    expect(getBearerToken("Bearer header.payload.signature")).toBe("header.payload.signature");
  });

  it.each([null, "", "Basic token", "Bearer token with spaces", "bearer token"])(
    "rejects malformed authorization %s",
    (authorization) => {
      expect(() => getBearerToken(authorization)).toThrow(ApiAuthError);
    },
  );
});

describe("readPrivyAuthConfig", () => {
  it("keeps the application secret server-only", () => {
    expect(
      readPrivyAuthConfig({
        NEXT_PUBLIC_PRIVY_APP_ID: "app-id",
        PRIVY_APP_SECRET: "server-secret",
      }),
    ).toEqual({ appId: "app-id", appSecret: "server-secret" });
  });

  it("fails closed when the server secret is absent", () => {
    expect(() => readPrivyAuthConfig({ NEXT_PUBLIC_PRIVY_APP_ID: "app-id" })).toThrowError(
      expect.objectContaining({ code: "auth_not_configured", status: 500 }),
    );
  });
});
