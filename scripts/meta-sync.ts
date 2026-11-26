import "dotenv/config";

import { runMetaSync, type SyncMode } from "@/lib/meta/sync";

// npm run meta:sync [-- --quick]  ·  Sincroniza Meta Ads a mano (local o con DATABASE_URL de prod).
const mode: SyncMode = process.argv.includes("--quick") ? "quick" : "full";

runMetaSync({ mode, force: true })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === "synced" ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
