import "dotenv/config";
import {
  SECOND_MONTH_KEY,
  syncGithubContributions,
} from "../src/modules/github-contributions/sync";
import { getDb } from "../src/lib/db";

async function main() {
  const reportMonth = process.argv[2] ?? SECOND_MONTH_KEY;
  console.log(await syncGithubContributions(reportMonth));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getDb().$disconnect();
  });
