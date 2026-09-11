import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Keypair } from "@solana/web3.js";

let cachedPath = "";
let cachedSponsor: Keypair | undefined;

export async function getSponsorWallet() {
  const configuredPath = process.env.SPONSOR_KEYPAIR_PATH?.trim();
  if (!configuredPath) throw new Error("SPONSOR_KEYPAIR_PATH is not configured");
  const absolutePath = resolve(process.cwd(), configuredPath);
  if (cachedSponsor && cachedPath === absolutePath) return cachedSponsor;

  const parsed: unknown = JSON.parse(await readFile(absolutePath, "utf8"));
  if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error("Sponsor keypair file is invalid");
  }
  cachedSponsor = Keypair.fromSecretKey(Uint8Array.from(parsed));
  cachedPath = absolutePath;
  return cachedSponsor;
}
