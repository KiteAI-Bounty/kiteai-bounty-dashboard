import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";
import { readEnvironment } from "@/config/env";
import { getDb } from "@/lib/db";
import { runNextJob } from "./queue";

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function main() {
  const env = readEnvironment(process.env);
  if (process.argv.includes("--check")) {
    console.log(
      JSON.stringify({
        event: "worker.config.valid",
        mode: env.DATA_MODE,
        handlers: ["system.ping", "ec.register_submission", "ec.sync_batch"],
        ecEnabled: env.EC_PROVIDER_MODE !== "mock",
        paymentsEnabled: false,
      }),
    );
    return;
  }
  if (env.DATA_MODE === "demo") {
    console.log(
      "Demo mode: worker is idle; no jobs or external actions are executed.",
    );
    return;
  }
  console.log(
    JSON.stringify({
      event: "worker.started",
      handlers: ["system.ping", "ec.register_submission", "ec.sync_batch"],
      ecProvider: env.EC_PROVIDER_MODE,
    }),
  );
  do {
    const processed = await runNextJob();
    if (process.argv.includes("--once")) break;
    if (!processed && !stopping) await delay(1000);
  } while (!stopping);
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) await getDb().$disconnect();
  });
