export const MAGICBLOCK_PRICE_PROGRAM = "PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd";
export const BTC_USD_FEED_ACCOUNT = "71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr";

export type CollectorConfig = {
  allowedOrigin: string;
  feedAccount: string;
  httpRpcUrl: string;
  port: number;
  wsRpcUrl: string;
};

export function loadCollectorConfig(environment: NodeJS.ProcessEnv = process.env): CollectorConfig {
  return {
    allowedOrigin: environment.PULSECAST_APP_ORIGIN ?? "http://localhost:3000",
    feedAccount: environment.MAGICBLOCK_BTC_FEED_ACCOUNT ?? BTC_USD_FEED_ACCOUNT,
    httpRpcUrl: environment.MAGICBLOCK_HTTP_RPC_URL ?? "https://devnet-as.magicblock.app",
    port: parsePort(environment.ORACLE_COLLECTOR_PORT),
    wsRpcUrl: environment.MAGICBLOCK_WS_RPC_URL ?? "wss://devnet-as.magicblock.app",
  };
}

function parsePort(value: string | undefined) {
  const port = value === undefined ? 8787 : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("ORACLE_COLLECTOR_PORT must be an integer between 1 and 65535");
  }
  return port;
}
