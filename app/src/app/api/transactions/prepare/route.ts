import { Connection, PublicKey } from "@solana/web3.js";
import { prepareOperationSchema, preparedOperationSchema, type PreparedOperation } from "@pulsecast/shared";
import { NextResponse } from "next/server";

import { deriveRoundAddress } from "@pulsecast/protocol";
import { buildEnterMarketTransaction } from "@/server/enter-market-transaction";
import { ApiAuthError, verifyPrivyWalletRequest } from "@/server/privy-auth";
import { fetchRoundIndex } from "@/server/round-index";
import { getSponsorWallet } from "@/server/sponsor-wallet";

const operations = new Map<string, PreparedOperation>();
const attempts = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const MAX_PREPARES_PER_WINDOW = 5;

export async function POST(request: Request) {
  try {
    const parsed = prepareOperationSchema.safeParse(await request.json());
    if (!parsed.success) return failure(400, "invalid_intent", "The transaction intent is invalid.");
    const intent = parsed.data;
    if (intent.action !== "enter_market") {
      return failure(400, "unsupported_action", "This sponsored action is not available yet.");
    }

    const session = await verifyPrivyWalletRequest(request, intent.wallet);
    if (!consumeRateLimit(session.userId)) {
      return failure(429, "rate_limited", "Too many transaction requests. Try again in one minute.");
    }
    const operationKey = `${session.userId}:${intent.idempotencyKey}`;
    const existing = operations.get(operationKey);
    if (existing && existing.expiresAt > Date.now()) return NextResponse.json(existing);

    const nowMs = Date.now();
    const index = await fetchRoundIndex(nowMs);
    const round = index.rounds.find((candidate) => candidate.id === intent.roundId);
    const nowSeconds = Math.floor(nowMs / 1_000);
    if (!round || nowSeconds < round.openAt || nowSeconds >= round.lockAt || round.status === "cancelled") {
      return failure(409, "betting_closed", "This round is not accepting predictions.");
    }
    const [expectedRound] = deriveRoundAddress(BigInt(intent.roundId));
    if (round.account !== expectedRound.toBase58()) {
      return failure(409, "invalid_round", "The round account does not match the protocol address.");
    }

    const sponsor = await getSponsorWallet();
    const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const transaction = buildEnterMarketTransaction({
      blockhash,
      predictedPrice: BigInt(intent.predictedPrice),
      roundId: BigInt(intent.roundId),
      sponsor,
      user: new PublicKey(intent.wallet),
    });
    const prepared = preparedOperationSchema.parse({
      expiresAt: nowMs + 45_000,
      operationId: crypto.randomUUID(),
      state: "awaiting_signature",
      transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"),
    });
    operations.set(operationKey, prepared);
    return NextResponse.json(prepared);
  } catch (error) {
    if (error instanceof ApiAuthError) return failure(error.status, error.code, error.message);
    if (error instanceof SyntaxError) return failure(400, "invalid_json", "The request body must be valid JSON.");
    console.error("Failed to prepare sponsored transaction", error instanceof Error ? error.message : "unknown error");
    return failure(503, "preparation_unavailable", "Transaction preparation is temporarily unavailable.");
  }
}

function consumeRateLimit(userId: string) {
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= MAX_PREPARES_PER_WINDOW) return false;
  attempts.set(userId, [...recent, now]);
  return true;
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}
