import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it } from "vitest";

import { buildClaimTransaction, buildWithdrawalTransaction } from "./account-transactions";

const blockhash = bs58.encode(new Uint8Array(32).fill(7));

describe("account transactions", () => {
  it("sponsors payout claims while retaining the user signature", () => {
    const sponsor = Keypair.generate();
    const user = Keypair.generate().publicKey;
    const transaction = buildClaimTransaction({ blockhash, refund: false, roundId: 22n, sponsor, user });
    expect(transaction.feePayer?.equals(sponsor.publicKey)).toBe(true);
    expect(transaction.instructions).toHaveLength(1);
    expect(transaction.signatures.find(({ publicKey }) => publicKey.equals(sponsor.publicKey))?.signature).not.toBeNull();
    expect(transaction.signatures.find(({ publicKey }) => publicKey.equals(user))?.signature).toBeNull();
  });

  it("creates the destination token account before transferring USDC", () => {
    const sponsor = Keypair.generate();
    const user = Keypair.generate().publicKey;
    const transaction = buildWithdrawalTransaction({ amount: 500_000n, blockhash, destination: Keypair.generate().publicKey, sponsor, user });
    expect(transaction.feePayer?.equals(sponsor.publicKey)).toBe(true);
    expect(transaction.instructions).toHaveLength(2);
    expect(transaction.signatures.find(({ publicKey }) => publicKey.equals(user))?.signature).toBeNull();
  });
});
