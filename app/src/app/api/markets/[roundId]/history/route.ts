import { NextResponse } from "next/server";

import { getMarketHistory } from "@/server/market-history";

const allowedDriftSeconds = 10 * 60;

export async function GET(_request: Request, context: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await context.params;
  const roundOpenAt = Number(roundId);
  const nowSeconds = Math.floor(Date.now() / 1_000);

  if (!Number.isSafeInteger(roundOpenAt) || roundOpenAt < 0 || roundOpenAt % 60 !== 0) {
    return NextResponse.json({ error: "Invalid round identifier." }, { status: 400 });
  }
  if (Math.abs(roundOpenAt - nowSeconds) > allowedDriftSeconds) {
    return NextResponse.json({ error: "Round is outside the live history window." }, { status: 404 });
  }

  return NextResponse.json(await getMarketHistory(roundOpenAt), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
