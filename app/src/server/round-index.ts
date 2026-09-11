import "server-only";

import { PULSECAST_PROGRAM_ID, ROUND_ACCOUNT_DISCRIMINATOR_BASE58, decodeRoundAccount, type DecodedRoundAccount } from "@pulsecast/protocol";
import { roundIndexSchema, type PublicRound, type RoundIndex } from "@pulsecast/shared";

type ProgramAccountResult = {
  account: { data: [string, string]; owner: string };
  pubkey: string;
};

// Round accounts only change on operator actions; clocks advance locally in the UI.
// A longer snapshot prevents the homepage, API polling, and entry preparation from
// independently exhausting the shared public devnet RPC quota.
const FRESH_FOR_MS = 15_000;
const STALE_FOR_MS = 10 * 60_000;
let cachedRounds: { fetchedAt: number; rounds: PublicRound[] } | undefined;
let pendingRounds: Promise<PublicRound[]> | undefined;

export async function fetchRoundIndex(serverTimeMs = Date.now()): Promise<RoundIndex> {
  const age = cachedRounds ? Date.now() - cachedRounds.fetchedAt : Number.POSITIVE_INFINITY;
  if (cachedRounds && age < FRESH_FOR_MS) {
    return roundIndexSchema.parse({ rounds: cachedRounds.rounds, serverTimeMs, source: "solana-devnet" });
  }

  try {
    pendingRounds ??= fetchRounds().finally(() => { pendingRounds = undefined; });
    const rounds = await pendingRounds;
    cachedRounds = { fetchedAt: Date.now(), rounds };
    return roundIndexSchema.parse({ rounds, serverTimeMs, source: "solana-devnet" });
  } catch (error) {
    if (cachedRounds && age < STALE_FOR_MS) {
      return roundIndexSchema.parse({ rounds: cachedRounds.rounds, serverTimeMs, source: "solana-devnet" });
    }
    throw error;
  }
}

async function fetchRounds(): Promise<PublicRound[]> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const body = JSON.stringify({
    id: 1,
    jsonrpc: "2.0",
    method: "getProgramAccounts",
    params: [PULSECAST_PROGRAM_ID.toBase58(), {
      commitment: "confirmed",
      encoding: "base64",
      filters: [{ memcmp: { bytes: ROUND_ACCOUNT_DISCRIMINATOR_BASE58, offset: 0 } }],
    }],
  });
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(rpcUrl, {
      body,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok || response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  if (!response?.ok) throw new Error(`Solana RPC returned HTTP ${response?.status ?? "unknown"}`);
  const payload: unknown = await response.json();
  const accounts = readProgramAccounts(payload);
  return accounts
    .map(({ account, pubkey }) => toPublicRound(pubkey, decodeRoundAccount(Buffer.from(account.data[0], "base64"))))
    .sort((left, right) => left.openAt - right.openAt)
    .slice(-100);
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
