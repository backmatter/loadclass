// Nightly job: rolls download_events into weekly_downloads on the templates table.
import { refreshWeeklyDownloads } from "../registry/download-accounting.ts";

async function run() {
  while (true) {
    try {
      const count = await refreshWeeklyDownloads();
      console.log(`[stats] refreshed weekly downloads for ${count} templates`);
    } catch (err) {
      console.error("[stats] error", err);
    }
    await new Promise((resolve) => setTimeout(resolve, 60 * 60 * 1000));
  }
}

run();
