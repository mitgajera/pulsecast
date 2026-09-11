import { NextResponse } from "next/server";

import { ApiAuthError, verifyPrivyRequest } from "@/server/privy-auth";

export async function GET(request: Request) {
  try {
    const session = await verifyPrivyRequest(request);
    return NextResponse.json({ authenticated: true, ...session });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { code: "authentication_failed", message: "Authentication could not be verified." },
      { status: 500 },
    );
  }
}
