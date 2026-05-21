/**
 * GitHub Actions entrypoint for the BidAssist bid-awards scraper.
 *
 * Scrapes BidAssist's tender-results listing (tenders at decision stage),
 * keeps results worth >= Rs 100 crore across every sector, and writes
 * data/bidassist-awards.json. The workflow commits it to the data branch.
 *
 * Run:  pnpm tsx scripts/scrape-bidassist-awards.mts
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { scrapeBidAssistAwards, BidAssistAwardsError } from "../lib/scrapers/bidassist-awards.ts";

const OUTPUT_PATH = path.resolve("data", "bidassist-awards.json");

async function writePayload(payload: unknown) {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

const cr = (v?: number) => (typeof v === "number" ? `Rs ${(v / 1e7).toFixed(0)} Cr` : "?");

async function main() {
  console.log("Scraping BidAssist bid-awards (tender results, >= Rs 100 Cr)...");
  const started = Date.now();

  let result;
  try {
    result = await scrapeBidAssistAwards();
  } catch (err) {
    const message = err instanceof BidAssistAwardsError ? err.message : String(err);
    console.error(`BidAssist awards scrape failed: ${message}`);
    await writePayload({
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      ok: false,
      error: message,
      sortMode: "scan",
      pagesFetched: 0,
      totalAvailable: null,
      totalScanned: 0,
      relevantCount: 0,
      awards: [],
    });
    process.exitCode = 1;
    return;
  }

  const durationMs = Date.now() - started;
  await writePayload({
    fetchedAt: new Date().toISOString(),
    durationMs,
    ok: true,
    sortMode: result.sortMode,
    pagesFetched: result.pagesFetched,
    totalAvailable: result.totalAvailable,
    totalScanned: result.totalScanned,
    relevantCount: result.awards.length,
    awards: result.awards,
    // Debug: pageInfo exposes the page's sort/pagination params; sampleRows
    // show parse quality and the value distribution.
    pageInfo: result.pageInfo,
    sampleRows: result.allRows.slice(0, 25),
  });

  console.log(
    `Sort mode: ${result.sortMode} (${result.pagesFetched} pages). Scanned ` +
      `${result.totalScanned} awards, ${result.awards.length} worth >= Rs 100 Cr, ` +
      `in ${durationMs}ms`,
  );
  for (const a of result.awards.slice(0, 12)) {
    const stage = a.resultStage ?? a.awardStage ?? "result";
    console.log(`  - ${cr(a.value)} [${stage}] :: ${a.title.slice(0, 60)}`);
  }
  if (result.sortMode === "scan") {
    console.warn("NOTE: value sort not found — scanned + filtered. Check pageInfo in the output.");
  }
  if (result.totalScanned === 0) {
    console.warn("WARNING: 0 awards parsed — the tender-results page came up empty.");
  }
}

main().catch((err) => {
  console.error("scrape-bidassist-awards failed:", err);
  process.exit(1);
});
