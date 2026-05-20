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
    view: result.view,
    pagesFetched: result.pagesFetched,
    totalRowsParsed: result.totalRowsParsed,
    relevantCount: result.tenders.length,
    tenders: result.tenders,
    // Debug: a sample of every parsed row (matched or not) so the parse
    // quality and the keyword filter can be inspected from the output.
    sampleRows: result.allRows.slice(0, 25),
  });

  console.log(
    `View: ${result.view === "14day" ? "Closing within 14 days" : "Closing today (POST fell back)"}`,
  );
  console.log(
    `Parsed ${result.totalRowsParsed} tender rows across ${result.pagesFetched} page(s), ` +
      `${result.tenders.length} matched watchlist sectors, in ${durationMs}ms`,
  );

  const strip = (html: string) =>
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .slice(0, 300_000);

  // When the 14-day POST fell back, dump the POST response so the Tapestry
  // form contract can be diagnosed.
  if (result.view === "today" && result.postDebug) {
    const postPath = path.resolve("data", "cppp-post-debug.html");
    await writeFile(postPath, strip(result.postDebug), "utf8");
    console.warn(
      `WARNING: 14-day POST fell back to "today". Saved data/cppp-post-debug.html ` +
        `(${result.postDebug.length} chars) for inspection.`,
    );
  }

  // Dump the listing HTML if the parse itself looks thin.
  if (result.totalRowsParsed < 20) {
    const debugPath = path.resolve("data", "cppp-debug.html");
    await writeFile(debugPath, strip(result.rawHtml), "utf8");
    console.warn(
      `WARNING: only ${result.totalRowsParsed} rows parsed — saved data/cppp-debug.html.`,
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
