import { NextResponse } from "next/server";

import { fetchRoundIndex } from "@/server/round-index";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await fetchRoundIndex(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Devnet market state is unavailable." }, { status: 503 });
  }
}
