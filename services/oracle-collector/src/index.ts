import { loadCollectorConfig } from "./config.js";
import { createCollectorServer, serverAddress } from "./http-server.js";
import { OracleCollector } from "./oracle-collector.js";

const config = loadCollectorConfig();
const collector = new OracleCollector(config);
const server = createCollectorServer(collector, config);

await collector.start();
server.listen(config.port, "0.0.0.0", () => {
  console.info(`PulseCast oracle collector listening at ${serverAddress(server)}`);
});

let stopping = false;
async function shutdown(signal: NodeJS.Signals) {
  if (stopping) return;
  stopping = true;
  console.info(`Received ${signal}; stopping oracle collector`);
  server.close();
  server.closeAllConnections();
  await collector.stop();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
