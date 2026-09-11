import { createHash } from "node:crypto";

import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  deriveConfigAddress,
  derivePredictionAddress,
  deriveRoundAddress,
  DEVNET_USDC_MINT,
  PULSECAST_PROGRAM_ID,
} from "@pulsecast/protocol";

const ENTER_MARKET_DISCRIMINATOR = createHash("sha256").update("global:enter_market").digest().subarray(0, 8);
const SUBMIT_PREDICTION_DISCRIMINATOR = createHash("sha256").update("global:submit_prediction").digest().subarray(0, 8);

type BuildEnterMarketTransactionInput = {
  blockhash: string;
  predictedPrice: bigint;
  roundId: bigint;
  sponsor: Keypair;
  user: PublicKey;
};

export function buildEnterMarketTransaction({ blockhash, predictedPrice, roundId, sponsor, user }: BuildEnterMarketTransactionInput) {
  const [config] = deriveConfigAddress();
  const [round] = deriveRoundAddress(roundId);
  const [prediction] = derivePredictionAddress(round, user);
  const userUsdc = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, user);
  const vault = getAssociatedTokenAddressSync(DEVNET_USDC_MINT, config, true);
  const instruction = new TransactionInstruction({
    data: ENTER_MARKET_DISCRIMINATOR,
    keys: [
      { isSigner: false, isWritable: false, pubkey: config },
      { isSigner: false, isWritable: true, pubkey: round },
      { isSigner: false, isWritable: true, pubkey: prediction },
      { isSigner: false, isWritable: false, pubkey: DEVNET_USDC_MINT },
      { isSigner: false, isWritable: true, pubkey: userUsdc },
      { isSigner: false, isWritable: true, pubkey: vault },
      { isSigner: true, isWritable: true, pubkey: user },
      { isSigner: true, isWritable: true, pubkey: sponsor.publicKey },
      { isSigner: false, isWritable: false, pubkey: ASSOCIATED_TOKEN_PROGRAM_ID },
      { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    programId: PULSECAST_PROGRAM_ID,
  });
  if (predictedPrice <= 0n || predictedPrice > 9_223_372_036_854_775_807n) throw new Error("Predicted price is outside the supported range");
  const predictionData = Buffer.alloc(16);
  SUBMIT_PREDICTION_DISCRIMINATOR.copy(predictionData, 0);
  predictionData.writeBigInt64LE(predictedPrice, 8);
  const submitPrediction = new TransactionInstruction({
    data: predictionData,
    keys: [
      { isSigner: false, isWritable: true, pubkey: prediction },
      { isSigner: false, isWritable: false, pubkey: PULSECAST_PROGRAM_ID },
      { isSigner: true, isWritable: false, pubkey: user },
    ],
    programId: PULSECAST_PROGRAM_ID,
  });
  const transaction = new Transaction({ feePayer: sponsor.publicKey, recentBlockhash: blockhash }).add(instruction, submitPrediction);
  transaction.partialSign(sponsor);
  return transaction;
}
