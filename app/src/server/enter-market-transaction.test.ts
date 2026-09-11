import { Keypair, Transaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { PULSECAST_PROGRAM_ID } from "@pulsecast/protocol";
import { buildEnterMarketTransaction } from "./enter-market-transaction";

describe("buildEnterMarketTransaction", () => {
  it("builds a canonical sponsor-signed entry transaction", () => {
    const sponsor = Keypair.generate();
    const user = Keypair.generate().publicKey;
    const transaction = buildEnterMarketTransaction({
      blockhash: Keypair.generate().publicKey.toBase58(),
      roundId: 42n,
      sponsor,
      user,
    });
    const decoded = Transaction.from(transaction.serialize({ requireAllSignatures: false }));

    expect(decoded.feePayer?.equals(sponsor.publicKey)).toBe(true);
    expect(decoded.instructions).toHaveLength(1);
    expect(decoded.instructions[0]?.programId.equals(PULSECAST_PROGRAM_ID)).toBe(true);
    expect(decoded.instructions[0]?.keys.filter((key) => key.isSigner).map((key) => key.pubkey.toBase58())).toEqual([
      user.toBase58(),
      sponsor.publicKey.toBase58(),
    ]);
    expect(decoded.signatures.find(({ publicKey }) => publicKey.equals(sponsor.publicKey))?.signature).not.toBeNull();
    expect(decoded.signatures.find(({ publicKey }) => publicKey.equals(user))?.signature).toBeNull();
  });
});
