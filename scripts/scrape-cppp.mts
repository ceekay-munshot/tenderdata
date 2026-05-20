/**
 * GitHub Actions entrypoint for the CPPP tender scraper.
 *
 * Fetches the CPPP "Latest Active Tenders" page, keyword-filters down to
 * watchlist-relevant tenders, and writes `data/cppp-tenders.json`. The
 * calling workflow commits that file to the `data` branch.
 *
 * Run:
 *   pnpm tsx scripts/scrape-cppp.mts
 *
 * Exit codes:
 *   0 — succeeded (file written)
 *   1 — unexpected error (network, parse, etc.)
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { scrapeLatestTenders, CpppFetchError } from "../lib/scrapers/cppp.ts";

const OUTPUT_PATH = path.resolve("data", "cppp-tenders.json");

async function main() {
  console.log("Scraping CPPP Latest Active Tenders...");
  const started = Date.now();

  let result;
  try {
    result = await scrapeLatestTenders();
  } catch (err) {
    if (err instanceof CpppFetchError) {
      console.error(`CPPP fetch failed: ${err.message}`);
      // Write an explicit error payload so the dashboard can show "feed error"
      // rather than silently going stale.
      await writePayload({
        fetchedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        ok: false,
        error: err.message,
        totalRowsParsed: 0,
        relevantCount: 0,
        tenders: [],
      });
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const durationMs = Date.now() - started;

  await writePayload({
    fetchedAt: new Date().toISOString(),
    durationMs,
    ok: true,
    totalRowsParsed: result.totalRowsParsed,
    relevantCount: result.tenders.length,
    tenders: result.tenders,
    ...(result.debugHtmlSample ? { debugHtmlSample: result.debugHtmlSample } : {}),
  });

  console.log(
    `Parsed ${result.totalRowsParsed} tender rows, ` +
      `${result.tenders.length} matched watchlist sectors, in ${durationMs}ms`,
  );
  if (result.totalRowsParsed === 0) {
    console.warn(
      "WARNING: 0 rows parsed — CPPP HTML structure may have changed. " +
        "A debugHtmlSample was saved to the output file for inspection.",
    );
  }
  for (const t of result.tenders.slice(0, 10)) {
    console.log(`  - [${t.matchedKeywords.join(", ")}] ${t.title.slice(0, 80)}`);
  }
}

async function writePayload(payload: unknown) {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

main().catch((err) => {
  console.error("scrape-cppp failed:", err);
  process.exit(1);
});
