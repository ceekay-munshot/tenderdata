/**
 * GitHub Actions entrypoint for the BidAssist bid-awards scraper.
 *
 * Scrapes BidAssist's tender-results listing (tenders at decision stage —
 * financial-bid opening, AOC release), keyword-filters to watchlist
 * sectors, and writes data/bidassist-awards.json. The workflow commits it
 * to the data branch.
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

async function main() {
  console.log("Scraping BidAssist bid-awards (tender results)...");
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
      source: "none",
      paginationParam: null,
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
    source: result.source,
    paginationParam: result.paginationParam,
    pagesFetched: result.pagesFetched,
    totalAvailable: result.totalAvailable,
    totalScanned: result.totalScanned,
    relevantCount: result.awards.length,
    awards: result.awards,
    // Debug: pageInfo lets the pagination model be re-probed from the
    // output if no param worked; sampleRows expose parse + filter quality.
    pageInfo: result.pageInfo,
    sampleRows: result.allRows.slice(0, 25),
  });

  const pagination = result.paginationParam
    ? `paginated via ?${result.paginationParam}, ${result.pagesFetched} pages`
    : "single page — pagination param not found";
  console.log(
    `Source: ${result.source} (${pagination}). Scanned ${result.totalScanned} awards, ` +
      `${result.awards.length} matched watchlist sectors, in ${durationMs}ms`,
  );
  for (const a of result.awards.slice(0, 12)) {
    const stage = a.resultStage ?? a.awardStage ?? "result";
    console.log(`  - [${a.matchedKeywords.join(", ")}] ${stage} :: ${a.title.slice(0, 65)}`);
  }
  if (result.totalScanned === 0) {
    console.warn("WARNING: 0 awards parsed — the tender-results page came up empty.");
  }
}

main().catch((err) => {
  console.error("scrape-bidassist-awards failed:", err);
  process.exit(1);
});
