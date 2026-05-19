/**
 * BSE Corporate Announcements scraper.
 *
 * Source: BSE's internal JSON endpoint used by bseindia.com/corporates/ann.html.
 *
 *   GET https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w
 *     ?pageno=1
 *     &strCat=-1                  (all categories)
 *     &strScrip=<6-digit code>    (e.g. 540073 for BLS)
 *     &strSearch=P                (search type — "P" returns recent filings)
 *     &strType=C                  ("C" = corporate announcements)
 *     &strPrevDate=YYYYMMDD       (lower bound)
 *     &strToDate=YYYYMMDD         (upper bound)
 *
 * The endpoint needs a browser-like User-Agent and a Referer header pointing
 * back at bseindia.com — without these BSE returns 403/empty.
 *
 * Response shape (simplified):
 *   { Table: [ { NEWSID, SCRIP_CD, NEWSSUB, HEADLINE, MORE, CATEGORYNAME,
 *                NEWS_DT, ATTACHMENTNAME, ... } ], Table1: [...] }
 *
 * We map this into the lighter BseAnnouncement type below.
 */

import type { Update } from "@/lib/types";

/**
 * BSE uses 6-digit numeric scrip codes, not tickers. Mapping for the seeded
 * watchlist. When users add new tickers we'll need to resolve their scrip
 * code via a lookup endpoint — for now we hardcode.
 */
export const BSE_SCRIPCODES: Record<string, number> = {
  BLS: 540073,
  BEL: 500049,
  HAL: 541154,
  RVNL: 542649,
  IRCON: 541956,
  LT: 500510,
};

export interface BseAnnouncement {
  /** Stable BSE NEWSID — useful for de-duplication */
  newsId: string;
  ticker: string;
  scripcode: number;
  companyName: string;
  /** Short headline shown in the BSE listing */
  headline: string;
  /** Longer body / additional details — may be empty */
  body: string;
  category: string;
  /** ISO 8601 timestamp */
  filedAt: string;
  /** Direct PDF link if the filing has an attachment */
  attachmentUrl?: string;
  /** Raw row for debugging — drop in production if size matters */
  raw?: Record<string, unknown>;
}

interface FetchOptions {
  /** Days of history to pull. Default 30. */
  daysBack?: number;
  /** Include the raw row in the response. Default false. */
  includeRaw?: boolean;
  /** Override fetch (useful for tests). */
  fetcher?: typeof fetch;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

const BSE_API = "https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w";

const REQUEST_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Referer: "https://www.bseindia.com/",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.bseindia.com",
};

export class BseFetchError extends Error {
  constructor(message: string, public status?: number, public body?: string) {
    super(message);
    this.name = "BseFetchError";
  }
}

/**
 * Pull recent corporate announcements for a single ticker.
 *
 * Throws BseFetchError on non-2xx or empty body. Empty Table[] is *not* an
 * error — just means no filings in the window.
 */
export async function fetchBseAnnouncements(
  ticker: string,
  opts: FetchOptions = {},
): Promise<BseAnnouncement[]> {
  const scripcode = BSE_SCRIPCODES[ticker.toUpperCase()];
  if (!scripcode) {
    throw new BseFetchError(
      `Unknown BSE scripcode for ticker "${ticker}". Add it to BSE_SCRIPCODES.`,
    );
  }

  const daysBack = opts.daysBack ?? 30;
  const fetcher = opts.fetcher ?? fetch;

  const toDate = formatBseDate(new Date());
  const fromDate = formatBseDate(new Date(Date.now() - daysBack * 86_400_000));

  const url = new URL(BSE_API);
  url.searchParams.set("pageno", "1");
  url.searchParams.set("strCat", "-1");
  url.searchParams.set("strPrevDate", fromDate);
  url.searchParams.set("strScrip", String(scripcode));
  url.searchParams.set("strSearch", "P");
  url.searchParams.set("strToDate", toDate);
  url.searchParams.set("strType", "C");

  const res = await fetcher(url.toString(), {
    method: "GET",
    headers: REQUEST_HEADERS,
    signal: opts.signal,
    // Cloudflare-only hint: skip cache so cron always sees fresh
    cf: { cacheTtl: 0, cacheEverything: false },
  } as RequestInit);

  if (!res.ok) {
    const body = await safeText(res);
    throw new BseFetchError(`BSE responded ${res.status}`, res.status, body);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    const body = await safeText(res);
    throw new BseFetchError(
      `BSE returned non-JSON (${contentType || "unknown"})`,
      res.status,
      body.slice(0, 200),
    );
  }

  const json = (await res.json()) as { Table?: BseRawRow[] };
  const rows = json.Table ?? [];

  return rows.map((row) => mapRow(row, ticker, scripcode, opts.includeRaw));
}

/** Pull announcements for a batch of tickers in parallel, with isolated errors. */
export async function fetchBseAnnouncementsForTickers(
  tickers: string[],
  opts: FetchOptions = {},
): Promise<{
  ok: { ticker: string; announcements: BseAnnouncement[] }[];
  failed: { ticker: string; error: string }[];
}> {
  const results = await Promise.allSettled(
    tickers.map((t) => fetchBseAnnouncements(t, opts).then((a) => ({ ticker: t, announcements: a }))),
  );

  const ok: { ticker: string; announcements: BseAnnouncement[] }[] = [];
  const failed: { ticker: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok.push(r.value);
    else failed.push({ ticker: tickers[i], error: String(r.reason?.message ?? r.reason) });
  });
  return { ok, failed };
}

// ---------------------------------------------------------------------------
// Classification — turn an announcement headline into an Update for the feed
// ---------------------------------------------------------------------------

const NEGATIVE_TRIGGERS = [
  /debar/i,
  /banned?/i,
  /penalt/i,
  /show\s+cause/i,
  /termination/i,
  /lost\s+contract/i,
  /loss\s+of\s+contract/i,
  /not.*L1\s+bidder/i,
  /resignation/i,
  /fraud/i,
  /forensic/i,
  /liquidated\s+damages/i,
];

const POSITIVE_TRIGGERS = [
  /order\s+win/i,
  /awarded/i,
  /letter\s+of\s+award|LOA/i,
  /letter\s+of\s+intent|LOI/i,
  /L1\s+bidder/i,
  /contract\s+won/i,
  /qualified\s+bidder/i,
];

const WATCH_TRIGGERS = [/auditor/i, /promoter\s+pledge/i, /resignation/i, /forensic/i];

export function classifyAnnouncement(
  ann: BseAnnouncement,
): { tone: "positive" | "negative" | "neutral"; matches: string[] } {
  const text = `${ann.headline}\n${ann.body}`.slice(0, 4000);
  const matches: string[] = [];
  let neg = 0;
  let pos = 0;

  for (const r of NEGATIVE_TRIGGERS) {
    const m = text.match(r);
    if (m) {
      neg++;
      matches.push(m[0]);
    }
  }
  for (const r of POSITIVE_TRIGGERS) {
    const m = text.match(r);
    if (m) {
      pos++;
      matches.push(m[0]);
    }
  }
  for (const r of WATCH_TRIGGERS) {
    const m = text.match(r);
    if (m && !matches.includes(m[0])) matches.push(m[0]);
  }

  const tone = neg > pos ? "negative" : pos > neg ? "positive" : "neutral";
  return { tone, matches };
}

/**
 * Convert a BSE announcement to the dashboard-facing Update shape so it can
 * flow into the Recent Updates strip directly. The tenderId is left blank
 * for now — linking is a separate step we'll add when we have the CPPP
 * tender list to match against.
 */
export function announcementToUpdate(ann: BseAnnouncement): Update {
  const { tone, matches } = classifyAnnouncement(ann);
  return {
    id: `bse-${ann.newsId}`,
    date: ann.filedAt,
    tenderId: "", // filled in by the linker once we know which tender this disclosure is about
    kind: "follow_up",
    ticker: ann.ticker,
    text: ann.headline,
    tone,
    context: matches.length ? `Triggers: ${matches.join(", ")}` : ann.category,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

interface BseRawRow {
  NEWSID?: string;
  SCRIP_CD?: number;
  SLONGNAME?: string;
  HEADLINE?: string;
  NEWSSUB?: string;
  MORE?: string;
  CATEGORYNAME?: string;
  NEWS_DT?: string;
  NEWSDATE?: string;
  ATTACHMENTNAME?: string;
  [k: string]: unknown;
}

function mapRow(
  row: BseRawRow,
  ticker: string,
  scripcode: number,
  includeRaw?: boolean,
): BseAnnouncement {
  const headline = (row.HEADLINE ?? row.NEWSSUB ?? "").toString().trim();
  const body = (row.MORE ?? "").toString().trim();
  const dateRaw = row.NEWS_DT ?? row.NEWSDATE ?? "";
  return {
    newsId: row.NEWSID?.toString() ?? `${scripcode}-${dateRaw}-${headline.slice(0, 30)}`,
    ticker,
    scripcode,
    companyName: row.SLONGNAME?.toString() ?? "",
    headline,
    body,
    category: row.CATEGORYNAME?.toString() ?? "",
    filedAt: parseBseDate(dateRaw),
    attachmentUrl: row.ATTACHMENTNAME
      ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${row.ATTACHMENTNAME}`
      : undefined,
    raw: includeRaw ? (row as Record<string, unknown>) : undefined,
  };
}

function formatBseDate(d: Date): string {
  // BSE expects YYYYMMDD (no separators)
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function parseBseDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  // Try ISO first ("2026-05-15T18:42:00")
  const iso = new Date(raw);
  if (!isNaN(iso.getTime())) return iso.toISOString();
  // Fallback: "15-May-2026 18:42:00"
  const m = raw.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,})[-\s/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mon, yyyy, hh = "0", mm = "0", ss = "0"] = m;
    const monthIdx = "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(mon.slice(0, 3).toLowerCase()) / 3;
    if (monthIdx >= 0) {
      return new Date(Date.UTC(+yyyy, monthIdx, +dd, +hh, +mm, +ss)).toISOString();
    }
  }
  return new Date().toISOString();
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
