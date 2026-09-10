export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await context.params;
  if (!/^\d+$/.test(roundId) || Number(roundId) % 60 !== 0) {
    return Response.json({ error: "Invalid round identifier." }, { status: 400 });
  }

  const collectorUrl = process.env.ORACLE_COLLECTOR_URL;
  if (!collectorUrl) {
    return Response.json({ error: "Live oracle stream is not configured." }, { status: 503 });
  }

  try {
    const upstream = await fetch(`${collectorUrl}/v1/stream`, {
      cache: "no-store",
      headers: { Accept: "text/event-stream" },
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: "Live oracle stream is unavailable." }, { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json({ error: "Live oracle stream is unavailable." }, { status: 502 });
  }
}
