import { Connection, PublicKey, type AccountInfo } from "@solana/web3.js";
import type { OracleSample } from "@pulsecast/shared";

import { MAGICBLOCK_PRICE_PROGRAM, type CollectorConfig } from "./config.js";
import { decodePriceAccount } from "./decode-price-account.js";
import { SampleBuffer } from "./sample-buffer.js";

type SampleListener = (sample: OracleSample) => void;

export class OracleCollector {
  readonly buffer = new SampleBuffer();
  readonly #connection: Connection;
  readonly #feedAccount: PublicKey;
  readonly #listeners = new Set<SampleListener>();
  #reconcileTimer?: NodeJS.Timeout;
  #subscriptionId?: number;
  #lastError: string | undefined;

  constructor(config: CollectorConfig) {
    this.#connection = new Connection(config.httpRpcUrl, {
      commitment: "confirmed",
      wsEndpoint: config.wsRpcUrl,
    });
    this.#feedAccount = new PublicKey(config.feedAccount);
  }

  async start() {
    await this.#reconcile();
    this.#subscriptionId = this.#connection.onAccountChange(
      this.#feedAccount,
      (account) => this.#ingest(account),
      "confirmed",
    );
    this.#reconcileTimer = setInterval(() => void this.#reconcile(), 2_000);
  }

  async stop() {
    if (this.#reconcileTimer) clearInterval(this.#reconcileTimer);
    if (this.#subscriptionId !== undefined) {
      await this.#connection.removeAccountChangeListener(this.#subscriptionId);
    }
  }

  subscribe(listener: SampleListener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  health(nowMs = Date.now()) {
    const latest = this.buffer.latest();
    return {
      error: this.#lastError,
      lagMs: latest ? Math.max(0, nowMs - latest.sourceTimestampMs) : null,
      sampleCount: this.buffer.size,
      status: latest && nowMs - latest.sourceTimestampMs < 5_000 ? "healthy" : "stale",
    } as const;
  }

  async #reconcile() {
    try {
      const account = await this.#connection.getAccountInfo(this.#feedAccount, "confirmed");
      if (!account) throw new Error("BTC oracle account was not found");
      this.#ingest(account);
      this.#lastError = undefined;
    } catch (error) {
      this.#lastError = error instanceof Error ? error.message : "Unknown oracle reconciliation error";
    }
  }

  #ingest(account: AccountInfo<Buffer>) {
    if (!account.owner.equals(new PublicKey(MAGICBLOCK_PRICE_PROGRAM))) {
      this.#lastError = "BTC oracle account owner does not match the MagicBlock price program";
      return;
    }
    try {
      const sample = decodePriceAccount(account.data);
      if (!this.buffer.add(sample)) return;
      this.#lastError = undefined;
      for (const listener of this.#listeners) listener(sample);
    } catch (error) {
      this.#lastError = error instanceof Error ? error.message : "Unknown oracle decode error";
    }
  }
}
