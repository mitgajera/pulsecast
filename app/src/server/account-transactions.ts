import { createHash } from "node:crypto";

import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { deriveConfigAddress, derivePredictionAddress, deriveRoundAddress, DEVNET_USDC_MINT, PULSECAST_PROGRAM_ID } from "@pulsecast/protocol";

const discriminator = (name: string) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);

export function buildClaimTransaction({ blockhash, refund, roundId, sponsor, user }: { blockhash: string; refund: boolean; roundId: bigint; sponsor: Keypair; user: PublicKey }) {
  const [config] = deriveConfigAddress();
  const [round] = deriveRoundAddress(roundId);
  const [prediction] = derivePredictionAddress(round, user);
  const vault = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, config, true);
  const userUsdc = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, user);
  const instruction = new TransactionInstruction({
    data: discriminator(refund ? "claim_refund" : "claim_payout"),
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: prediction, isSigner: false, isWritable: true },
      { pubkey: DEVNET_USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: userUsdc, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: sponsor.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PULSECAST_PROGRAM_ID,
  });
  const transaction = new Transaction({ feePayer: sponsor.publicKey, recentBlockhash: blockhash }).add(instruction);
  transaction.partialSign(sponsor);
  return transaction;
}

export function buildWithdrawalTransaction({ amount, blockhash, destination, sponsor, user }: { amount: bigint; blockhash: string; destination: PublicKey; sponsor: Keypair; user: PublicKey }) {
  const source = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, user);
  const destinationToken = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, destination);
  const transaction = new Transaction({ feePayer: sponsor.publicKey, recentBlockhash: blockhash }).add(
    createAssociatedTokenAccountIdempotentInstruction(sponsor.publicKey, destinationToken, destination, DEVNET_USDC_MINT),
    createTransferCheckedInstruction(source, DEVNET_USDC_MINT, destinationToken, user, amount, 6),
  );
  transaction.partialSign(sponsor);
  return transaction;
}
