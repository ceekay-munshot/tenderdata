/**
 * Runtime loader for scraped BSE data.
 *
 * The data is committed by the GHA `scrape-bse.yml` workflow to a dedicated
 * `data` branch (so it never triggers a Cloudflare rebuild of the app). We
 * fetch the raw URL at request time with ISR caching — Next.js + the
 * Workers runtime keep the cached body around for `revalidate` seconds.
 *
 * The repo owner/name and branch are configurable via env so they're easy
 * to override during local dev or if the deployment moves.
 */

import type { Update } from "@/lib/types";
import type { BseAnnouncement } from "@/lib/scrapers/bse";

const DEFAULT_OWNER = process.env.NEXT_PUBLIC_REPO_OWNER ?? "ceekay-munshot";
const DEFAULT_REPO = process.env.NEXT_PUBLIC_REPO_NAME ?? "tenderdata";
const DATA_BRANCH = process.env.NEXT_PUBLIC_DATA_BRANCH ?? "data";

const RAW_URL = `https://raw.githubusercontent.com/${DEFAULT_OWNER}/${DEFAULT_REPO}/${DATA_BRANCH}/data/bse-updates.json`;

/** Time after which we consider the cached scrape "stale" and warn in UI. */
const STALE_AFTER_MS = 90 * 60 * 1000; // 90 min

/** How long Next.js / the Workers cache keeps the fetched payload. */
const REVALIDATE_SECONDS = 60;

export interface BsePayload {
  fetchedAt: string;
  durationMs: number;
  window: { daysBack: number };
  requestedTickers: string[];
  successCount: number;
  failureCount: number;
  failures: { ticker: string; error: string }[];
  counts: {
    announcements: number;
    negative: number;
    positive: number;
    neutral: number;
  };
  announcements: (BseAnnouncement & {
    classification: { tone: "positive" | "negative" | "neutral"; matches: string[] };
  })[];
  updates: Update[];
}

export interface BseLoadResult {
  payload: BsePayload | null;
  fetchedAt: string | null;
  ageMs: number | null;
  stale: boolean;
  /** "ok" — payload loaded; "empty" — file exists but contains no data;
   *  "missing" — branch/file not yet created; "error" — fetch threw. */
  status: "ok" | "empty" | "missing" | "error";
  error?: string;
}

export async function loadBseUpdates(): Promise<BseLoadResult> {
  try {
    const res = await fetch(RAW_URL, {
      // Next.js / OpenNext both honour this — request is cached and reused
      // across requests within the window.
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      return {
        payload: null,
        fetchedAt: null,
        ageMs: null,
        stale: true,
        status: "missing",
        error: "Data branch / file not found — first GHA scrape hasn't pushed yet.",
      };
    }
    if (!res.ok) {
      return {
        payload: null,
        fetchedAt: null,
        ageMs: null,
        stale: true,
        status: "error",
        error: `Fetch ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 200),
      };
    }

    const payload = (await res.json()) as BsePayload;
    const fetchedAtMs = new Date(payload.fetchedAt).getTime();
    const ageMs = Number.isFinite(fetchedAtMs) ? Date.now() - fetchedAtMs : null;
    const stale = ageMs === null ? true : ageMs > STALE_AFTER_MS;

    return {
      payload,
      fetchedAt: payload.fetchedAt,
      ageMs,
      stale,
      status: payload.announcements.length === 0 ? "empty" : "ok",
    };
  } catch (err) {
    return {
      payload: null,
      fetchedAt: null,
      ageMs: null,
      stale: true,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
