import { Connection, PublicKey } from "@solana/web3.js";
import { prepareOperationSchema, preparedOperationSchema, type PreparedOperation } from "@pulsecast/shared";
import { NextResponse } from "next/server";

import { decodeRoundAccount, deriveRoundAddress } from "@pulsecast/protocol";
import { buildEnterMarketTransaction } from "@/server/enter-market-transaction";
import { buildClaimTransaction, buildWithdrawalTransaction } from "@/server/account-transactions";
import { ApiAuthError, verifyPrivyWalletRequest } from "@/server/privy-auth";
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
    const nowMs = Date.now();
    const session = await verifyPrivyWalletRequest(request, intent.wallet);
    if (!consumeRateLimit(session.userId)) {
      return failure(429, "rate_limited", "Too many transaction requests. Try again in one minute.");
    }
    const operationKey = `${session.userId}:${intent.idempotencyKey}`;
    const existing = operations.get(operationKey);
    if (existing && existing.expiresAt > Date.now()) return NextResponse.json(existing);

    const sponsor = await getSponsorWallet();
    const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
    const user = new PublicKey(intent.wallet);
    const roundAddress = intent.action === "withdraw_usdc" ? null : deriveRoundAddress(BigInt(intent.roundId))[0];
    const [{ blockhash }, roundInfo] = await Promise.all([
      connection.getLatestBlockhash("confirmed"),
      roundAddress ? connection.getAccountInfo(roundAddress, "confirmed") : Promise.resolve(null),
    ]);
    let transaction;
    if (intent.action === "withdraw_usdc") {
      const destination = new PublicKey(intent.destination);
      if (destination.equals(user)) return failure(400, "same_destination", "Enter a different destination wallet.");
      transaction = buildWithdrawalTransaction({ amount: BigInt(intent.amount), blockhash, destination, sponsor, user });
    } else {
      if (!roundInfo) return failure(409, "invalid_round", "The round account is unavailable.");
      const round = decodeRoundAccount(roundInfo.data);
      if (intent.action === "enter_market") {
        const nowSeconds = Math.floor(nowMs / 1_000);
        if (BigInt(nowSeconds) < round.openAt || BigInt(nowSeconds) >= round.lockAt || round.status === "cancelled") return failure(409, "betting_closed", "This round is not accepting predictions.");
        transaction = buildEnterMarketTransaction({ blockhash, predictedPrice: BigInt(intent.predictedPrice), roundId: BigInt(intent.roundId), sponsor, user });
      } else if (intent.action === "claim_payout" || intent.action === "claim_refund") {
        if (intent.action === "claim_payout" && round.status !== "settled") return failure(409, "not_claimable", "This payout is not ready to claim.");
        if (intent.action === "claim_refund" && round.status !== "cancelled") return failure(409, "not_refundable", "This round is not refundable.");
        transaction = buildClaimTransaction({ blockhash, refund: intent.action === "claim_refund", roundId: BigInt(intent.roundId), sponsor, user });
      } else {
        return failure(400, "unsupported_action", "This sponsored action is not available yet.");
      }
    }
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
