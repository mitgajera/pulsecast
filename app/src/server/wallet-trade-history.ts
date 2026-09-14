import { createHash } from "node:crypto";

import { type Connection, type ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import { decodeRoundAccount, DEVNET_USDC_MINT, PULSECAST_PROGRAM_ID } from "@pulsecast/protocol";
import bs58 from "bs58";

export type WalletTrade = {
  actualPrice: number | null;
  payoutUsdc: number | null;
  predictedPrice: number;
  roundId: string;
  stakeUsdc: number;
  status: string;
  submittedAt: number;
};

const discriminator = (name: string) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const ENTER = discriminator("enter_market");
const SUBMIT = discriminator("submit_prediction");
const CLAIM = discriminator("claim_payout");
const REFUND = discriminator("claim_refund");

export async function loadWalletTradeHistory(connection: Connection, owner: PublicKey): Promise<WalletTrade[]> {
  const signatures = await connection.getSignaturesForAddress(owner, { limit: 100 }, "confirmed");
  const batches = chunk(signatures.map(({ signature }) => signature), 10);
  const transactions = (await Promise.all(batches.map((batch) => connection.getParsedTransactions(batch, { maxSupportedTransactionVersion: 0 })))).flat();
  const byRound = new Map<string, WalletTrade>();

  for (const transaction of transactions) {
    if (!transaction || !transaction.meta || transaction.meta.err) continue;
    const instructions = transaction.transaction.message.instructions.flatMap((instruction) => {
      if (!("data" in instruction) || instruction.programId.toBase58() !== PULSECAST_PROGRAM_ID.toBase58()) return [];
      const data = Buffer.from(bs58.decode(instruction.data));
      return [{ accounts: instruction.accounts, data }];
    });
    const enter = instructions.find(({ data }) => startsWith(data, ENTER));
    const submit = instructions.find(({ data }) => startsWith(data, SUBMIT));
    const claim = instructions.find(({ data }) => startsWith(data, CLAIM) || startsWith(data, REFUND));
    const action = enter ?? claim;
    const roundAddress = action?.accounts[1]?.toBase58();
    if (!roundAddress) continue;
    const existing = byRound.get(roundAddress);
    const deltaUsdc = walletTokenDelta(transaction.meta, owner.toBase58()) / 1_000_000;

    if (enter && submit && submit.data.length >= 16) {
      byRound.set(roundAddress, {
        actualPrice: existing?.actualPrice ?? null,
        payoutUsdc: existing?.payoutUsdc ?? null,
        predictedPrice: Number(submit.data.readBigInt64LE(8)) / 100_000_000,
        roundId: roundAddress,
        stakeUsdc: Math.max(0, -deltaUsdc),
        status: existing?.status ?? "pending",
        submittedAt: transaction.blockTime ?? existing?.submittedAt ?? 0,
      });
    } else if (claim && existing) {
      byRound.set(roundAddress, {
        ...existing,
        payoutUsdc: Math.max(0, deltaUsdc),
        status: startsWith(claim.data, REFUND) ? "cancelled" : "settled",
      });
    } else if (claim) {
      byRound.set(roundAddress, {
        actualPrice: null,
        payoutUsdc: Math.max(0, deltaUsdc),
        predictedPrice: 0,
        roundId: roundAddress,
        stakeUsdc: startsWith(claim.data, REFUND) ? Math.max(0, deltaUsdc) : 0,
        status: startsWith(claim.data, REFUND) ? "cancelled" : "settled",
        submittedAt: transaction.blockTime ?? 0,
      });
    }
  }

  const roundAddresses = [...byRound.keys()].map((address) => new PublicKey(address));
  const roundAccounts = roundAddresses.length ? await connection.getMultipleAccountsInfo(roundAddresses, "confirmed") : [];
  roundAddresses.forEach((address, index) => {
    const trade = byRound.get(address.toBase58());
    const account = roundAccounts[index];
    if (!trade || !account) return;
    const round = decodeRoundAccount(account.data);
    byRound.set(address.toBase58(), {
      ...trade,
      actualPrice: round.actualPrice > 0n ? Number(round.actualPrice) / 100_000_000 : null,
      roundId: round.id.toString(),
      stakeUsdc: trade.stakeUsdc || Number(round.entryAmount) / 1_000_000,
      status: trade.status === "pending" ? round.status : trade.status,
    });
  });

  return [...byRound.values()].filter((trade) => trade.submittedAt > 0).sort((a, b) => b.submittedAt - a.submittedAt);
}

function walletTokenDelta(meta: NonNullable<ParsedTransactionWithMeta["meta"]>, owner: string) {
  const mint = DEVNET_USDC_MINT.toBase58();
  const amount = (balances: typeof meta.postTokenBalances) => BigInt(balances?.find((balance) => balance.owner === owner && balance.mint === mint)?.uiTokenAmount.amount ?? "0");
  return Number(amount(meta.postTokenBalances) - amount(meta.preTokenBalances));
}

function startsWith(data: Buffer, prefix: Buffer) { return data.length >= prefix.length && data.subarray(0, prefix.length).equals(prefix); }
function chunk<T>(items: T[], size: number) { return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size)); }
