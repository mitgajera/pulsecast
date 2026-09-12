import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Keypair } from "@solana/web3.js";

let cachedPath = "";
let cachedSponsor: Keypair | undefined;

export async function getSponsorWallet() {
  const inlineKeypair = process.env.SPONSOR_KEYPAIR?.trim();
  if (inlineKeypair) {
    if (cachedSponsor && cachedPath === "environment") return cachedSponsor;
    cachedSponsor = parseKeypair(inlineKeypair);
    cachedPath = "environment";
    return cachedSponsor;
  }
  const configuredPath = process.env.SPONSOR_KEYPAIR_PATH?.trim();
  if (!configuredPath) throw new Error("SPONSOR_KEYPAIR or SPONSOR_KEYPAIR_PATH is not configured");
  const absolutePath = resolve(/* turbopackIgnore: true */ process.cwd(), configuredPath);
  if (cachedSponsor && cachedPath === absolutePath) return cachedSponsor;

  cachedSponsor = parseKeypair(await readFile(/* turbopackIgnore: true */ absolutePath, "utf8"));
  cachedPath = absolutePath;
  return cachedSponsor;
}

function parseKeypair(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error("Sponsor keypair file is invalid");
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}
