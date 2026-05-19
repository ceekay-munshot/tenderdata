/**
 * GitHub Actions entrypoint for the BSE scraper.
 *
 * Hits BSE for every BSE-listed ticker on the watchlist, classifies each
 * filing, and writes a single JSON payload to `data/bse-updates.json`.
 * The workflow that calls this then commits the file to the `data` branch.
 *
 * Run:
 *   pnpm tsx scripts/scrape-bse.mts            # default window (30 days)
 *   DAYS_BACK=60 pnpm tsx scripts/scrape-bse.mts
 *
 * Exit codes:
 *   0 — succeeded (file written; may contain zero rows if everything failed)
 *   1 — unexpected error (network, JSON parse, etc.)
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  BSE_SCRIPCODES,
  fetchBseAnnouncementsForTickers,
  classifyAnnouncement,
  announcementToUpdate,
  type BseAnnouncement,
} from "../lib/scrapers/bse.ts";
import { watchlist } from "../lib/mock-data/watchlist.ts";

const DAYS_BACK = Number(process.env.DAYS_BACK ?? 30) || 30;
const OUTPUT_PATH = path.resolve("data", "bse-updates.json");

async function main() {
  const tickers = watchlist
    .map((w) => w.ticker)
    .filter((t) => Boolean(BSE_SCRIPCODES[t]));

  if (tickers.length === 0) {
    console.error("No BSE-listed tickers on the watchlist — nothing to scrape.");
    await writeEmpty(tickers);
    return;
  }

  console.log(`Scraping ${tickers.length} ticker(s): ${tickers.join(", ")}`);
  console.log(`Window: last ${DAYS_BACK} days`);

  const started = Date.now();
  const { ok, failed } = await fetchBseAnnouncementsForTickers(tickers, {
    daysBack: DAYS_BACK,
  });
  const durationMs = Date.now() - started;

  const annotated = ok.flatMap((r) =>
    r.announcements.map((ann) => ({
      ...ann,
      classification: classifyAnnouncement(ann),
    })),
  );
  const updates = annotated
    .map((a) => announcementToUpdate(a))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const payload = {
    fetchedAt: new Date().toISOString(),
    durationMs,
    window: { daysBack: DAYS_BACK },
    requestedTickers: tickers,
    successCount: ok.length,
    failureCount: failed.length,
    failures: failed,
    counts: {
      announcements: annotated.length,
      negative: annotated.filter((a) => a.classification.tone === "negative").length,
      positive: annotated.filter((a) => a.classification.tone === "positive").length,
      neutral: annotated.filter((a) => a.classification.tone === "neutral").length,
    },
    announcements: annotated,
    updates,
  };

  await writeFileAtomic(payload);

  console.log(
    `Wrote ${updates.length} updates ` +
      `(${payload.counts.negative} neg / ${payload.counts.positive} pos / ${payload.counts.neutral} neutral) ` +
      `from ${ok.length}/${tickers.length} tickers in ${durationMs}ms`,
  );
  if (failed.length) {
    console.warn("Failed tickers:");
    for (const f of failed) console.warn(`  ${f.ticker}: ${f.error}`);
  }
}

async function writeEmpty(tickers: string[]) {
  await writeFileAtomic({
    fetchedAt: new Date().toISOString(),
    durationMs: 0,
    window: { daysBack: DAYS_BACK },
    requestedTickers: tickers,
    successCount: 0,
    failureCount: 0,
    failures: [],
    counts: { announcements: 0, negative: 0, positive: 0, neutral: 0 },
    announcements: [] as (BseAnnouncement & { classification: ReturnType<typeof classifyAnnouncement> })[],
    updates: [] as ReturnType<typeof announcementToUpdate>[],
  });
}

async function writeFileAtomic(payload: unknown) {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

main().catch((err) => {
  console.error("scrape-bse failed:", err);
  process.exit(1);
});
