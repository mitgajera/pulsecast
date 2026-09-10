import { loadCollectorConfig } from "./config.js";
import { createCollectorServer, serverAddress } from "./http-server.js";
import { OracleCollector } from "./oracle-collector.js";

const config = loadCollectorConfig();
const collector = new OracleCollector(config);
const server = createCollectorServer(collector, config);

await collector.start();
server.listen(config.port, "127.0.0.1", () => {
  console.info(`PulseCast oracle collector listening at ${serverAddress(server)}`);
});

async function shutdown() {
  server.close();
  await collector.stop();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
