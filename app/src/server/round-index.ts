import "server-only";

import { PULSECAST_PROGRAM_ID, ROUND_ACCOUNT_DISCRIMINATOR_BASE58, decodeRoundAccount, type DecodedRoundAccount } from "@pulsecast/protocol";
import { roundIndexSchema, type PublicRound, type RoundIndex } from "@pulsecast/shared";

type ProgramAccountResult = {
  account: { data: [string, string]; owner: string };
  pubkey: string;
};

export async function fetchRoundIndex(serverTimeMs = Date.now()): Promise<RoundIndex> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "getProgramAccounts",
      params: [PULSECAST_PROGRAM_ID.toBase58(), {
        commitment: "confirmed",
        encoding: "base64",
        filters: [{ memcmp: { bytes: ROUND_ACCOUNT_DISCRIMINATOR_BASE58, offset: 0 } }],
      }],
    }),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error(`Solana RPC returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  const accounts = readProgramAccounts(payload);
  const rounds = accounts
    .map(({ account, pubkey }) => toPublicRound(pubkey, decodeRoundAccount(Buffer.from(account.data[0], "base64"))))
    .sort((left, right) => left.openAt - right.openAt)
    .slice(-100);

  return roundIndexSchema.parse({ rounds, serverTimeMs, source: "solana-devnet" });
}

export function toPublicRound(account: string, round: DecodedRoundAccount): PublicRound {
  return {
    account,
    actualPrice: round.actualPrice.toString(),
    actualPublishTime: safeNumber(round.actualPublishTime, "actual publish time"),
    entryAmount: round.entryAmount.toString(),
    feeBps: round.feeBps,
    id: round.id.toString(),
    lockAt: safeNumber(round.lockAt, "lock time"),
    maxErrorBps: round.maxErrorBps,
    openAt: safeNumber(round.openAt, "open time"),
    predictionCount: round.predictionCount,
    resolveAt: safeNumber(round.resolveAt, "resolve time"),
    schemaVersion: round.schemaVersion,
    startPrice: round.startPrice.toString(),
    startPublishTime: safeNumber(round.startPublishTime, "start publish time"),
    status: round.status,
    totalPool: round.totalPool.toString(),
  };
}

function readProgramAccounts(payload: unknown): ProgramAccountResult[] {
  if (!payload || typeof payload !== "object" || !("result" in payload) || !Array.isArray(payload.result)) {
    throw new Error("Solana RPC returned an invalid program-account response");
  }
  return payload.result.map((value) => {
    if (!value || typeof value !== "object" || !("pubkey" in value) || typeof value.pubkey !== "string" || !("account" in value)) {
      throw new Error("Solana RPC returned a malformed program account");
    }
    const account = value.account;
    if (!account || typeof account !== "object" || !("owner" in account) || account.owner !== PULSECAST_PROGRAM_ID.toBase58() || !("data" in account) || !Array.isArray(account.data) || typeof account.data[0] !== "string") {
      throw new Error("Solana RPC returned malformed or incorrectly owned account data");
    }
    return { account: { data: [account.data[0], String(account.data[1] ?? "base64")], owner: account.owner }, pubkey: value.pubkey };
  });
}

function safeNumber(value: bigint, field: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`Round ${field} exceeds JavaScript's safe integer range`);
  return number;
}
