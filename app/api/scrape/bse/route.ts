/**
 * BSE Corporate Announcements scraper endpoint.
 *
 *   GET /api/scrape/bse                  — all watchlist tickers, last 30 days
 *   GET /api/scrape/bse?ticker=BLS       — single ticker
 *   GET /api/scrape/bse?days=7           — narrower window
 *   GET /api/scrape/bse?raw=1            — include the raw BSE row (debug)
 *
 * Returns JSON with per-ticker results, classification tags, and a flat
 * "updates" array shaped exactly like the dashboard's Recent Updates strip
 * consumes — so once D1 storage lands, we can swap mock data for this
 * endpoint with a single import change.
 *
 * Runs in the edge/workers runtime (no Node APIs) so it works on Cloudflare
 * Workers via OpenNext.
 */

import { NextResponse } from "next/server";
import {
  BSE_SCRIPCODES,
  fetchBseAnnouncementsForTickers,
  classifyAnnouncement,
  announcementToUpdate,
} from "@/lib/scrapers/bse";
import { watchlist } from "@/lib/mock-data";

export const runtime = "edge";
// Don't cache — we want fresh data every hit. (CF cron is the right place
// to throttle, not the response cache.)
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tickerParam = url.searchParams.get("ticker");
  const daysBack = Number(url.searchParams.get("days") ?? 30) || 30;
  const includeRaw = url.searchParams.get("raw") === "1";

  const tickers = tickerParam
    ? [tickerParam.toUpperCase()]
    : watchlist.map((w) => w.ticker).filter((t) => BSE_SCRIPCODES[t]);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "No tickers requested or watchlist is empty for BSE-listed names." },
      { status: 400 },
    );
  }

  const started = Date.now();
  const { ok, failed } = await fetchBseAnnouncementsForTickers(tickers, {
    daysBack,
    includeRaw,
  });

  // Classify each announcement and produce dashboard-ready updates.
  const announcements = ok.flatMap((r) =>
    r.announcements.map((ann) => ({
      ...ann,
      classification: classifyAnnouncement(ann),
    })),
  );
  const updates = announcements
    .map((a) => announcementToUpdate(a))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json(
    {
      meta: {
        requestedTickers: tickers,
        daysBack,
        durationMs: Date.now() - started,
        ok: ok.length,
        failed: failed.length,
      },
      failures: failed,
      announcements,
      updates,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
