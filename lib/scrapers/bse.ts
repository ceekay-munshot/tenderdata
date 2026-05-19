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

/**
 * Trigger-word patterns.
 *
 * Classifier uses a strict hierarchy (negative > positive > watch > neutral)
 * rather than counting matches — counting double-trips on phrases like "not
 * the L1 bidder" (matches "not L1" as negative AND "L1 bidder" as positive),
 * and the dashboard treating "loss of contract" announcements as positive is
 * exactly the kind of bug that would make a trader miss a BLS-style move.
 */
const NEGATIVE_TRIGGERS = [
  /\bdebar/i,
  /\bbanned?\b/i,
  /\bpenalt/i,
  /\bshow\s+cause\b/i,
  /\btermina(?:tion|ted)\b/i,
  /\blost\s+contract\b/i,
  /\bloss\s+of\b/i,
  /\bnot\s+(?:the\s+)?L1\b/i,
  /\bfraud\b/i,
  /\bliquidated\s+damages\b/i,
  /\bwithdrawn\b/i,
  /\border\s+cancellation\b/i,
  /\bdisqualif/i,
];

// Real BSE headlines use a wider vocabulary than the obvious "order win" /
// "awarded" patterns. Examples seen in production:
//   - "BEL receives Rs.1251 Crore order for supply of ..."
//   - "BEL receives orders worth Rs. 569 Crore."
//   - "L&T Wins Orders (Significant*) for Power Transmission & Distribution"
//   - "L&T Secures (Large*) Order to Reinforce India's Energy Security"
//   - "L&T Strengthens its EPC Leadership with Significant* Order from BCGCL"
//   - "Receipt of LOA from NMDC Limited."
// The patterns below match all of those.
const POSITIVE_TRIGGERS = [
  // X wins (significant/large/mega) order(s)
  /\bwins?\s+(?:\(?[\w*]+\)?\s+)?orders?\b/i,
  // X receives (an) order(s) | X receives Rs.N Cr order
  /\breceives?\s+(?:an?\s+|the\s+)?(?:Rs\.?\s*[\d.,]+\s*(?:Cr|Crore)?\s+)?orders?\b/i,
  // X secures (large/mega) order
  /\bsecures?\s+(?:\(?[\w*]+\)?\s+)?orders?\b/i,
  // X bags (an) order
  /\bbags?\s+(?:an?\s+)?orders?\b/i,
  // "Strengthens ... with Significant*/Large/Mega Order from BCGCL"
  // (asterisk is BSE's own annotation for order-size buckets)
  /\b(?:significant|large|mega)\*?\s+order\s+(?:from|for|to)\b/i,
  // Receipt of LOA / LOI / order
  /\breceipt\s+of\s+(?:LOA|LOI|order|contract|letter\s+of\s+(?:award|intent))\b/i,
  // Legacy / explicit patterns kept for safety
  /\border\s+win\b/i,
  /\bawarded\b/i,
  /\bletter\s+of\s+award\b|\bLOA\b/i,
  /\bletter\s+of\s+intent\b|\bLOI\b/i,
  /\bL1\s+bidder\b/i,
  /\bcontract\s+(?:won|signed)\b/i,
  /\bqualified\s+bidder\b/i,
  /\bemerged?\s+(?:as\s+)?L1\b/i,
  /\bdeclared?\s+(?:as\s+)?L1\b/i,
];

const WATCH_TRIGGERS = [
  /\bresignation\b/i,
  /\bauditor\b/i,
  /\bforensic\b/i,
  /\bpromoter\s+pledge\b/i,
  /\bopen\s+offer\b/i,
  /\binsider\s+trading\b/i,
];

export function classifyAnnouncement(
  ann: BseAnnouncement,
): { tone: "positive" | "negative" | "neutral"; matches: string[] } {
  const text = `${ann.headline}\n${ann.body}`.slice(0, 4000);

  const negMatches: string[] = [];
  const posMatches: string[] = [];
  const watchMatches: string[] = [];

  for (const r of NEGATIVE_TRIGGERS) {
    const m = text.match(r);
    if (m) negMatches.push(m[0]);
  }
  for (const r of POSITIVE_TRIGGERS) {
    const m = text.match(r);
    if (m) posMatches.push(m[0]);
  }
  for (const r of WATCH_TRIGGERS) {
    const m = text.match(r);
    if (m) watchMatches.push(m[0]);
  }

  // Strict hierarchy: a single negative trigger wins, regardless of any
  // positives picked up in the same body.
  const tone: "positive" | "negative" | "neutral" =
    negMatches.length > 0
      ? "negative"
      : posMatches.length > 0
      ? "positive"
      : "neutral";

  return { tone, matches: [...negMatches, ...posMatches, ...watchMatches] };
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
