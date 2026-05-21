/**
 * GitHub Actions entrypoint for the BidAssist tender scraper.
 *
 * Scrapes the BidAssist active-tenders listing (all government portals,
 * de-walled + normalised), keeps tenders worth >= Rs 100 crore across
 * every sector, and writes data/bidassist-tenders.json. The workflow
 * commits it to the data branch.
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

const cr = (v?: number) => (typeof v === "number" ? `Rs ${(v / 1e7).toFixed(0)} Cr` : "?");

async function main() {
  console.log("Scraping BidAssist active tenders (>= Rs 100 Cr)...");
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
      sortMode: "scan",
      apiCalls: 0,
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
    sortMode: result.sortMode,
    apiCalls: result.apiCalls,
    totalScanned: result.totalScanned,
    relevantCount: result.tenders.length,
    tenders: result.tenders,
    // Debug: a sample of every row so parse quality can be inspected.
    sampleRows: result.allRows.slice(0, 25),
  });

  console.log(
    `Sort mode: ${result.sortMode}. Scanned ${result.totalScanned} tenders via ` +
      `${result.apiCalls} API call(s), ${result.tenders.length} worth >= Rs 100 Cr, ` +
      `in ${durationMs}ms`,
  );
  for (const t of result.tenders.slice(0, 12)) {
    console.log(`  - ${cr(t.value)} :: ${t.title.slice(0, 70)}`);
  }
  if (result.totalScanned === 0) {
    console.warn("WARNING: 0 tenders parsed — BidAssist API shape may have changed.");
  } else if (result.tenders.length === 0) {
    console.warn("WARNING: 0 tenders cleared Rs 100 Cr — check sortMode / the value field.");
  }
}

main().catch((err) => {
  console.error("scrape-bidassist failed:", err);
  process.exit(1);
});
