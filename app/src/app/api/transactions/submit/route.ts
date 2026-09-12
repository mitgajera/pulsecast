import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { PULSECAST_PROGRAM_ID } from "@pulsecast/protocol";
import { NextResponse } from "next/server";

import { ApiAuthError, verifyPrivyWalletRequest } from "@/server/privy-auth";
import { getSponsorWallet } from "@/server/sponsor-wallet";

const allowedPrograms = new Set([PULSECAST_PROGRAM_ID.toBase58(), TOKEN_PROGRAM_ID.toBase58(), ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { transaction?: unknown; wallet?: unknown };
    if (typeof body.wallet !== "string" || typeof body.transaction !== "string") return failure(400, "Invalid signed transaction.");
    await verifyPrivyWalletRequest(request, body.wallet);
    const transaction = Transaction.from(Buffer.from(body.transaction, "base64"));
    const wallet = new PublicKey(body.wallet);
    const sponsor = await getSponsorWallet();
    if (!transaction.feePayer?.equals(sponsor.publicKey)) return failure(403, "Invalid transaction fee payer.");
    if (!transaction.signatures.find((entry) => entry.publicKey.equals(wallet))?.signature) return failure(403, "Wallet signature is missing.");
    if (transaction.instructions.some((instruction) => !allowedPrograms.has(instruction.programId.toBase58()))) return failure(403, "Transaction contains an unsupported program.");
    const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
    const signature = await connection.sendRawTransaction(transaction.serialize(), { maxRetries: 2, skipPreflight: true });
    return NextResponse.json({ signature });
  } catch (error) {
    if (error instanceof ApiAuthError) return failure(error.status, error.message);
    console.error("Failed to submit signed transaction", error instanceof Error ? error.message : "unknown error");
    return failure(503, "Transaction broadcast failed. Try again.");
  }
}

function failure(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}
