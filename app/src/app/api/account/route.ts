import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { decodePredictionAccount, decodeRoundAccount, DEVNET_USDC_MINT, PREDICTION_ACCOUNT_DISCRIMINATOR, PREDICTION_ACCOUNT_SIZE, PULSECAST_PROGRAM_ID } from "@pulsecast/protocol";
import bs58 from "bs58";
import { NextResponse } from "next/server";

import { ApiAuthError, verifyPrivyWalletRequest } from "@/server/privy-auth";

export async function GET(request: Request) {
  try {
    const wallet = new URL(request.url).searchParams.get("wallet") ?? "";
    await verifyPrivyWalletRequest(request, wallet);
    const owner = new PublicKey(wallet);
    const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
    const tokenAddress = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, owner);
    const [balanceResult, accounts] = await Promise.all([
      connection.getTokenAccountBalance(tokenAddress, "confirmed").catch(() => null),
      connection.getProgramAccounts(PULSECAST_PROGRAM_ID, {
        commitment: "confirmed",
        filters: [
          { dataSize: PREDICTION_ACCOUNT_SIZE },
          { memcmp: { offset: 0, bytes: bs58.encode(PREDICTION_ACCOUNT_DISCRIMINATOR) } },
          { memcmp: { offset: 40, bytes: owner.toBase58() } },
        ],
      }),
    ]);
    const decoded = accounts.map(({ account, pubkey }) => ({ address: pubkey, prediction: decodePredictionAccount(account.data) }));
    const roundAccounts = await connection.getMultipleAccountsInfo(decoded.map(({ prediction }) => prediction.round), "confirmed");
    const predictions = decoded.map(({ address, prediction }, index) => {
      const roundInfo = roundAccounts[index];
      const round = roundInfo ? decodeRoundAccount(roundInfo.data) : null;
      const claimType = round?.status === "cancelled" ? "claim_refund" : "claim_payout";
      const claimable = !prediction.claimed && (round?.status === "settled" || round?.status === "cancelled");
      return {
        account: address.toBase58(),
        actualPrice: round && round.actualPrice > 0n ? Number(round.actualPrice) / 100 : null,
        claimType,
        claimable,
        claimed: prediction.claimed,
        error: prediction.scored ? Number(prediction.error) / 100 : null,
        payoutUsdc: Number(prediction.payout) / 1_000_000,
        predictedPrice: Number(prediction.predictedPrice) / 100,
        roundId: round?.id.toString() ?? null,
        status: round?.status ?? "unavailable",
        submittedAt: Number(prediction.submittedAt),
      };
    }).sort((a, b) => b.submittedAt - a.submittedAt);
    return NextResponse.json({ balanceUsdc: Number(balanceResult?.value.amount ?? 0) / 1_000_000, tokenAccount: tokenAddress.toBase58(), wallet, predictions });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("Failed to load account", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ message: "Account data is temporarily unavailable." }, { status: 503 });
  }
}
