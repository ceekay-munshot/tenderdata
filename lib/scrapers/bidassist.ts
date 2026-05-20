/**
 * BidAssist (bidassist.com) scraper — the automated multi-portal source.
 *
 * BidAssist is a tender aggregator: it has already de-walled every
 * government portal (CPPP, IREPS, GeM, state e-proc) and normalised them
 * into one feed. Its listing pages are server-rendered and embed the full
 * tender data as a `window.__INITIAL_STATE__` JSON blob — no API auth, no
 * captcha, no OTP.
 *
 * We fetch the paginated "all tenders / active" listing, pull
 * __INITIAL_STATE__.tenders.content[], map each tender, and keyword-filter
 * to watchlist sectors.
 *
 * Runs ONLY in the GHA scraper (Node). The app imports types only.
 */

import { matchTenderKeywords } from "./sector-keywords";

/** Paginated active-tenders listing. pageNumber/pageSize drive pagination. */
function listingUrl(pageNumber: number, pageSize: number): string {
  const u = new URL("https://bidassist.com/all-tenders/active");
  u.searchParams.set("sort", "RELEVANCE:DESC");
  u.searchParams.set("pageNumber", String(pageNumber));
  u.searchParams.set("pageSize", String(pageSize));
  u.searchParams.set("tenderEntity", "TENDER");
  return u.toString();
}

const PAGE_SIZE = 10; // BidAssist's proven anonymous page size
const MAX_PAGES = 12;
const PAGE_DELAY_MS = 600;

const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export class BidAssistError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "BidAssistError";
  }
}

export interface BidAssistTender {
  tenderId: string;
  refNo: string;
  title: string;
  buyer: string;
  /** BidAssist's purchaser grouping, e.g. "Railways", "Defence". */
  purchaserGroup?: string;
  /** Which government portal the tender originally came from. */
  procurementSource?: string;
  state?: string;
  /** Tender value in INR. */
  value?: number;
  /** Earnest money deposit in INR. */
  emd?: number;
  /** ISO — last date to submit bids (the key D-day proxy). */
  bidDeadline: string | null;
  /** ISO — when the tender was published. */
  postedAt: string | null;
  /** BidAssist's own sector tags. */
  sectorNames: string[];
  detailUrl?: string;
  /** Watchlist sector keywords this tender matched. */
  matchedKeywords: string[];
}

export interface BidAssistScrapeResult {
  /** Tenders that matched a watchlist sector keyword. */
  tenders: BidAssistTender[];
  /** Every tender parsed (matchedKeywords may be empty). */
  allRows: BidAssistTender[];
  totalScanned: number;
  pagesFetched: number;
  /** First page's HTML — caller may persist it for debugging. */
  rawHtml: string;
}

interface FetchOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** Pre-supplied HTML for a single page — skips the network (tests). */
  html?: string;
  maxPages?: number;
}

type RawTender = Omit<BidAssistTender, "matchedKeywords">;

export async function scrapeBidAssist(opts: FetchOptions = {}): Promise<BidAssistScrapeResult> {
  if (opts.html != null) {
    const rows = parseInitialState(opts.html);
    return finalise(rows, 1, opts.html);
  }

  const fetcher = opts.fetcher ?? fetch;
  const maxPages = opts.maxPages ?? MAX_PAGES;

  let rows: RawTender[] = [];
  let firstHtml = "";
  let pagesFetched = 0;
  let totalPages = 1;

  for (let page = 0; page < Math.min(maxPages, totalPages); page++) {
    let html: string;
    try {
      html = await fetchWithRetry(listingUrl(page, PAGE_SIZE), fetcher, opts.signal);
    } catch {
      break; // keep whatever we have
    }
    if (page === 0) firstHtml = html;

    const state = extractInitialState(html);
    const pageObj = state?.tenders as
      | { content?: unknown[]; totalPages?: number }
      | undefined;
    if (!pageObj || !Array.isArray(pageObj.content)) break;

    rows = rows.concat(pageObj.content.map(mapTender));
    pagesFetched++;
    if (typeof pageObj.totalPages === "number" && pageObj.totalPages > 0) {
      totalPages = pageObj.totalPages;
    }
    if (pageObj.content.length === 0) break;

    if (page + 1 < Math.min(maxPages, totalPages)) {
      await delay(PAGE_DELAY_MS);
    }
  }

  return finalise(dedupe(rows), pagesFetched, firstHtml);
}

function finalise(rows: RawTender[], pagesFetched: number, rawHtml: string): BidAssistScrapeResult {
  const allRows: BidAssistTender[] = rows.map((r) => ({
    ...r,
    matchedKeywords: matchTenderKeywords(
      r.title,
      r.buyer,
      r.purchaserGroup,
      r.sectorNames.join(" "),
    ).matchedKeywords,
  }));
  return {
    tenders: allRows.filter((t) => t.matchedKeywords.length > 0),
    allRows,
    totalScanned: rows.length,
    pagesFetched,
    rawHtml,
  };
}

// ---------------------------------------------------------------------------
// HTTP — BidAssist is a real site and can be flaky; retry on socket errors.
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  fetcher: typeof fetch,
  signal: AbortSignal | undefined,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetcher(url, { headers: REQUEST_HEADERS, signal });
      if (!res.ok) throw new BidAssistError(`BidAssist responded ${res.status}`, res.status);
      return await res.text();
    } catch (err) {
      lastErr = err;
      await delay(1500 * attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new BidAssistError(String(lastErr));
}

// ---------------------------------------------------------------------------
// __INITIAL_STATE__ extraction + tender mapping
// ---------------------------------------------------------------------------

/**
 * Pull the `window.__INITIAL_STATE__ = {...}` JSON object out of the page.
 * Uses balanced-brace scanning — a regex can't handle the nested braces.
 */
export function extractInitialState(html: string): { tenders?: unknown } | null {
  const marker = "window.__INITIAL_STATE__";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf("{", idx);
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\" && inStr) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(html.slice(start, end));
  } catch {
    return null;
  }
}

/** Parse the tender rows out of one page's HTML. */
export function parseInitialState(html: string): RawTender[] {
  const state = extractInitialState(html);
  const content = (state?.tenders as { content?: unknown[] } | undefined)?.content;
  if (!Array.isArray(content)) return [];
  return content.map(mapTender);
}

interface RawBidAssistTender {
  tenderId?: string;
  tenderNoticeNo?: string;
  sourceTenderId?: string;
  tenderDescription?: string;
  tenderDetails?: string;
  purchaserName?: string;
  displayPurchaserName?: string;
  purchaserGroup?: string;
  procurementSource?: string;
  value?: number;
  emd?: number;
  bidDeadLine?: number;
  postingDate?: number;
  sectorNames?: string[];
  location?: { state?: string };
}

function mapTender(raw: unknown): RawTender {
  const t = raw as RawBidAssistTender;
  const tenderId = String(t.tenderId ?? "");
  const buyer = String(t.purchaserName ?? t.displayPurchaserName ?? "").trim();
  return {
    tenderId,
    refNo: String(t.tenderNoticeNo ?? t.sourceTenderId ?? tenderId).trim(),
    title: cleanTitle(t.tenderDescription ?? t.tenderDetails ?? ""),
    buyer,
    purchaserGroup: t.purchaserGroup ?? undefined,
    procurementSource: t.procurementSource ?? undefined,
    state: t.location?.state ?? undefined,
    value: typeof t.value === "number" ? t.value : undefined,
    emd: typeof t.emd === "number" ? t.emd : undefined,
    bidDeadline: epochToIso(t.bidDeadLine),
    postedAt: epochToIso(t.postingDate),
    sectorNames: Array.isArray(t.sectorNames) ? t.sectorNames : [],
    detailUrl: tenderId ? buildDetailUrl(buyer, tenderId) : undefined,
  };
}

function cleanTitle(raw: string): string {
  return String(raw)
    .replace(/^[\s"']+|[\s"']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function epochToIso(ms?: number): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function buildDetailUrl(buyer: string, tenderId: string): string {
  const slug = buyer
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tender";
  return `https://bidassist.com/global-tenders/${slug}/detail-${tenderId}`;
}

function dedupe(rows: RawTender[]): RawTender[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.tenderId || r.refNo;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
