"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { preparedOperationSchema } from "@pulsecast/shared";

type EntryProgress = "preparing" | "signing";

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export function useSponsoredEntry() {
  const { getAccessToken } = usePrivy();
  const { signTransaction } = useSignTransaction();
  const { wallets } = useWallets();

  async function enterMarket(roundId: string, walletAddress: string, predictedPrice: string, onProgress: (progress: EntryProgress) => void) {
    const wallet = wallets.find((candidate) => candidate.address === walletAddress);
    if (!wallet) throw new Error("Your Solana wallet is not ready. Reconnect and try again.");
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Your session expired. Sign in again.");

    onProgress("preparing");
    const response = await fetch("/api/transactions/prepare", {
      body: JSON.stringify({
        action: "enter_market",
        idempotencyKey: crypto.randomUUID(),
        predictedPrice,
        roundId,
        wallet: walletAddress,
      }),
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      method: "POST",
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "The entry transaction could not be prepared.";
      throw new Error(message);
    }
    const prepared = preparedOperationSchema.parse(payload);
    if (prepared.expiresAt <= Date.now()) throw new Error("The signing request expired. Try again.");

    onProgress("signing");
    const { signedTransaction } = await signTransaction({
      chain: "solana:devnet",
      transaction: decodeBase64(prepared.transaction),
      wallet,
    });
    const submitResponse = await fetch("/api/transactions/submit", {
      body: JSON.stringify({ transaction: btoa(String.fromCharCode(...signedTransaction)), wallet: walletAddress }),
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      method: "POST",
    });
    const submitted = await submitResponse.json() as { message?: string; signature?: string };
    if (!submitResponse.ok || !submitted.signature) throw new Error(submitted.message ?? "Transaction broadcast failed.");
    return submitted.signature;
  }

  return { enterMarket };
}
