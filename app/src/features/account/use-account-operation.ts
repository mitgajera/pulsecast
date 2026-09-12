"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { preparedOperationSchema, type PrepareOperation } from "@pulsecast/shared";
import bs58 from "bs58";

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

export function useAccountOperation() {
  const { getAccessToken } = usePrivy();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useWallets();

  async function submit(intent: PrepareOperation) {
    const wallet = wallets.find((candidate) => candidate.address === intent.wallet);
    if (!wallet) throw new Error("Your Solana wallet is not ready. Reconnect and try again.");
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Your session expired. Sign in again.");
    const response = await fetch("/api/transactions/prepare", {
      body: JSON.stringify(intent),
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      method: "POST",
    });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string" ? payload.message : "The transaction could not be prepared.");
    const prepared = preparedOperationSchema.parse(payload);
    const { signature } = await signAndSendTransaction({ chain: "solana:devnet", transaction: decodeBase64(prepared.transaction), wallet });
    return bs58.encode(signature);
  }

  return { submit };
}
