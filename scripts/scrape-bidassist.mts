/**
 * GitHub Actions entrypoint for the BidAssist tender scraper.
 *
 * Scrapes the BidAssist active-tenders listing (all government portals,
 * de-walled + normalised), keyword-filters to watchlist sectors, and
 * writes data/bidassist-tenders.json. The workflow commits it to the
 * data branch.
 *
 * Run:  pnpm tsx scripts/scrape-bidassist.mts
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { scrapeBidAssist, BidAssistError } from "../lib/scrapers/bidassist.ts";

const OUTPUT_PATH = path.resolve("data", "bidassist-tenders.json");

async function writePayload(payload: unknown) {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function main() {
  console.log("Scraping BidAssist active tenders...");
  const started = Date.now();

  let result;
  try {
    result = await scrapeBidAssist();
  } catch (err) {
    const message = err instanceof BidAssistError ? err.message : String(err);
    console.error(`BidAssist scrape failed: ${message}`);
    await writePayload({
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      ok: false,
      error: message,
      pagesFetched: 0,
      totalScanned: 0,
      relevantCount: 0,
      tenders: [],
    });
    process.exitCode = 1;
    return;
  }

  const durationMs = Date.now() - started;
  await writePayload({
    fetchedAt: new Date().toISOString(),
    durationMs,
    ok: true,
    pagesFetched: result.pagesFetched,
    totalScanned: result.totalScanned,
    relevantCount: result.tenders.length,
    tenders: result.tenders,
    // Debug: a sample of every row so parse quality + the keyword filter
    // can be inspected from the output.
    sampleRows: result.allRows.slice(0, 25),
  });

  console.log(
    `Scanned ${result.totalScanned} tenders across ${result.pagesFetched} page(s), ` +
      `${result.tenders.length} matched watchlist sectors, in ${durationMs}ms`,
  );
  for (const t of result.tenders.slice(0, 12)) {
    console.log(`  - [${t.matchedKeywords.join(", ")}] ${t.title.slice(0, 75)}`);
  }
  if (result.totalScanned === 0) {
    console.warn("WARNING: 0 tenders parsed — BidAssist page structure may have changed.");
  }
}

main().catch((err) => {
  console.error("scrape-bidassist failed:", err);
  process.exit(1);
});
