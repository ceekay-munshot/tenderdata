/**
 * BidAssist bid-awards (tender results) scraper.
 *
 * BidAssist's "tender results" product tracks tenders past the bidding
 * phase — financial-bid opening, AOC (Award of Contract) release. Each
 * award entity carries the result stage, the result date, value, buyer
 * and sector: the "a result is coming — here's when" signal.
 *
 * IMPORTANT: the public listing does NOT name the winning bidder. The
 * winner lives inside the AOC document, which BidAssist paywalls. This
 * scraper surfaces *which* tenders are at decision stage and *when* — not
 * who won. Naming the winner needs a source-portal AOC fetch.
 *
 * Source: the /tender-results/all-tenders/active page server-renders a
 * window.__INITIAL_STATE__ JSON blob whose `tenders.content[]` holds the
 * award entities. The SSR blob is the *only* source — the dedicated
 * /api/bid-award/* endpoints 404, and /api/tender/tenders ignores
 * tenderEntity (every variant returns the active-tender feed byte-for-
 * byte, so it can't serve awards).
 *
 * Pagination is probed at runtime: the scraper fetches the bare page,
 * then tries ?page=2 / ?pageNumber=2 and keeps whichever returns awards
 * the bare page didn't. Probing with index 2 (not 1) detects the param
 * for both 0- and 1-indexed pagers. It then walks pages up to the page's
 * own totalPages (capped). If neither param works it scrapes a single
 * page; the result reports paginationParam=null and the raw pageInfo
 * blob so the pagination model can be re-probed from the output.
 *
 * Runs ONLY in the GHA scraper (Node). The app imports types only.
 */

import { matchTenderKeywords } from "./sector-keywords";

const RESULTS_PAGE_URL = "https://bidassist.com/tender-results/all-tenders/active";

/** Max result pages to walk once a pagination param is confirmed. */
const PAGE_CAP = 12;
const REQUEST_DELAY_MS = 600;

const PAGE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export class BidAssistAwardsError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "BidAssistAwardsError";
  }
}

export interface BidAssistAward {
  /** BidAssist's bid-award id. */
  awardId: string;
  /** Source-portal tender id (e.g. the eprocure tender id). */
  tenderId: string;
  /** Award/tender reference number. */
  refNo: string;
  title: string;
  buyer: string;
  /** Which government portal the tender originally came from. */
  procurementSource?: string;
  /** WORKS / GOODS / SERVICES. */
  typeOfContract?: string;
  state?: string;
  /** Contract value in INR. */
  value?: number;
  currency?: string;
  /** Pipeline stage code, e.g. "FINANCIAL_BID_OPENING_DATE". */
  awardStage?: string;
  /** Human-readable result stage, e.g. "Potential AOC Released". */
  resultStage?: string;
  /** ISO — date of the result stage (when the decision lands). */
  resultDate: string | null;
  /** ISO — when this award record was first seen. */
  postedAt: string | null;
  /** ISO — estimated/actual contract date. */
  contractDate: string | null;
  /** Whether the Award-of-Contract document (with the winner) exists. */
  aocAvailable: boolean;
  documentCount: number;
  sectorNames: string[];
  detailUrl?: string;
  /** Watchlist sector keywords this award matched. */
  matchedKeywords: string[];
}

export interface BidAssistAwardsScrapeResult {
  /** Awards that matched a watchlist sector keyword. */
  awards: BidAssistAward[];
  /** Every award pulled (matchedKeywords may be empty). */
  allRows: BidAssistAward[];
  totalScanned: number;
  /** Result pages actually fetched. */
  pagesFetched: number;
  /** Query param that paginated the SSR page, or null if none worked. */
  paginationParam: string | null;
  /** totalElements reported by the page's embedded state, if any. */
  totalAvailable: number | null;
  /** Raw __INITIAL_STATE__.pageInfo from page 0 — pagination metadata. */
  pageInfo: unknown;
  source: "ssr" | "none";
}

interface FetchOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** Override the page cap (tests). */
  pageCap?: number;
}

type RawAward = Omit<BidAssistAward, "matchedKeywords">;

interface SsrState {
  /** Award rows only — non-award rows are filtered out here. */
  rows: unknown[];
  totalPages: number | null;
  totalElements: number | null;
  pageInfo: unknown;
}

export async function scrapeBidAssistAwards(
  opts: FetchOptions = {},
): Promise<BidAssistAwardsScrapeResult> {
  const fetcher = opts.fetcher ?? fetch;
  const pageCap = opts.pageCap ?? PAGE_CAP;

  const collected: unknown[] = [];
  const seen = new Set<string>();
  let pagesFetched = 0;

  /** Add only unseen award rows; return how many were new. */
  const ingest = (rows: unknown[]): number => {
    let added = 0;
    for (const r of rows) {
      const k = rowKey(r);
      if (k && !seen.has(k)) {
        seen.add(k);
        collected.push(r);
        added++;
      }
    }
    return added;
  };

  const empty = (): BidAssistAwardsScrapeResult => ({
    awards: [],
    allRows: [],
    totalScanned: 0,
    pagesFetched,
    paginationParam: null,
    totalAvailable: null,
    pageInfo: null,
    source: "none",
  });

  // Page 0 — the bare results page.
  let first: SsrState;
  try {
    first = await fetchSsrState(fetcher, RESULTS_PAGE_URL, opts.signal);
    pagesFetched++;
  } catch {
    return empty();
  }
  ingest(first.rows);
  if (collected.length === 0) {
    const base = empty();
    return { ...base, totalAvailable: first.totalElements, pageInfo: first.pageInfo };
  }

  // Probe the pagination param. Index 2 differs from the bare page for
  // both 0-indexed (page 2 = 3rd) and 1-indexed (page 2 = 2nd) pagers.
  let paginationParam: string | null = null;
  for (const param of ["page", "pageNumber"]) {
    await delay(REQUEST_DELAY_MS);
    try {
      const probe = await fetchSsrState(
        fetcher,
        `${RESULTS_PAGE_URL}?${param}=2`,
        opts.signal,
      );
      pagesFetched++;
      if (ingest(probe.rows) > 0) {
        paginationParam = param;
        break;
      }
    } catch {
      // try the next candidate param
    }
  }

  // Walk the remaining pages with the working param. p=1 may duplicate
  // the bare page on a 1-indexed pager — de-dupe absorbs it.
  if (paginationParam) {
    const lastPage = Math.min(first.totalPages ?? pageCap, pageCap);
    for (let p = 1; p <= lastPage; p++) {
      await delay(REQUEST_DELAY_MS);
      try {
        const page = await fetchSsrState(
          fetcher,
          `${RESULTS_PAGE_URL}?${paginationParam}=${p}`,
          opts.signal,
        );
        pagesFetched++;
        ingest(page.rows);
      } catch {
        break;
      }
    }
  }

  const allRows: BidAssistAward[] = collected.map(mapAward).map((r) => ({
    ...r,
    matchedKeywords: matchTenderKeywords(r.title, r.buyer, "", r.sectorNames.join(" "))
      .matchedKeywords,
  }));

  return {
    awards: allRows.filter((a) => a.matchedKeywords.length > 0),
    allRows,
    totalScanned: allRows.length,
    pagesFetched,
    paginationParam,
    totalAvailable: first.totalElements,
    pageInfo: first.pageInfo,
    source: allRows.length > 0 ? "ssr" : "none",
  };
}

// ---------------------------------------------------------------------------
// SSR fetch — window.__INITIAL_STATE__ on the tender-results page
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchSsrState(
  fetcher: typeof fetch,
  url: string,
  signal?: AbortSignal,
): Promise<SsrState> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetcher(url, { headers: PAGE_HEADERS, redirect: "follow", signal });
      if (!res.ok) {
        throw new BidAssistAwardsError(`tender-results page responded ${res.status}`, res.status);
      }
      const html = await res.text();
      const state = extractInitialState(html);
      const stateObj =
        state && typeof state === "object" ? (state as Record<string, unknown>) : {};
      const tenders = stateObj.tenders;
      if (tenders && typeof tenders === "object") {
        const t = tenders as Record<string, unknown>;
        return {
          rows: (Array.isArray(t.content) ? t.content : []).filter(isAwardRow),
          totalPages: typeof t.totalPages === "number" ? t.totalPages : null,
          totalElements: typeof t.totalElements === "number" ? t.totalElements : null,
          pageInfo: stateObj.pageInfo ?? null,
        };
      }
      return { rows: [], totalPages: null, totalElements: null, pageInfo: stateObj.pageInfo ?? null };
    } catch (err) {
      lastErr = err;
      await delay(1000 * attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new BidAssistAwardsError(String(lastErr));
}

/** Balanced-brace extraction of window.__INITIAL_STATE__ = {...}. */
function extractInitialState(html: string): unknown | null {
  const idx = html.indexOf("window.__INITIAL_STATE__");
  if (idx === -1) return null;
  const start = html.indexOf("{", idx);
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
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
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// row validation + keys
// ---------------------------------------------------------------------------

/** A row is an award if it carries a bid-award id/stage or the result entity tag. */
function isAwardRow(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  const hasStr = (k: string) => typeof r[k] === "string" && (r[k] as string).length > 0;
  return (
    hasStr("bidAwardId") ||
    hasStr("bidAwardStage") ||
    hasStr("bidAwardResultStage") ||
    r.tenderEntity === "TENDER_RESULT"
  );
}

/** Stable de-dupe key for a raw award row. */
function rowKey(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const r = raw as Record<string, unknown>;
  return String(r.tenderId ?? r.sourceBidAwardId ?? r.bidAwardId ?? "");
}

// ---------------------------------------------------------------------------
// award mapping
// ---------------------------------------------------------------------------

interface RawBidAssistAward {
  bidAwardId?: string;
  sourceBidAwardId?: string;
  tenderId?: string;
  bidAwardRefNo?: string;
  aocDescription?: string;
  tenderDetails?: string;
  purchaserName?: string;
  displayPurchaserName?: string;
  procurementSource?: string;
  typeOfContract?: string;
  value?: number;
  currency?: string;
  bidAwardStage?: string;
  bidAwardResultStage?: string;
  bidAwardStageDate?: number;
  postingDate?: number;
  dateCreated?: number;
  contractDate?: number;
  aocDetailsAvailable?: boolean;
  documentCount?: number;
  sectorNames?: string[];
  location?: { state?: string };
}

function mapAward(raw: unknown): RawAward {
  const t = raw as RawBidAssistAward;
  const tenderId = String(t.tenderId ?? t.sourceBidAwardId ?? "");
  const buyer = cleanText(String(t.purchaserName ?? t.displayPurchaserName ?? ""));
  return {
    awardId: String(t.bidAwardId ?? t.sourceBidAwardId ?? tenderId),
    tenderId,
    refNo: cleanText(String(t.bidAwardRefNo ?? tenderId)),
    title: cleanText(t.aocDescription ?? t.tenderDetails ?? ""),
    buyer,
    procurementSource: t.procurementSource ?? undefined,
    typeOfContract: t.typeOfContract ?? undefined,
    state: t.location?.state ?? undefined,
    value: typeof t.value === "number" && t.value > 0 ? t.value : undefined,
    currency: t.currency ?? undefined,
    awardStage: t.bidAwardStage ?? undefined,
    resultStage: t.bidAwardResultStage ?? undefined,
    resultDate: epochToIso(t.bidAwardStageDate),
    postedAt: epochToIso(t.postingDate) ?? epochToIso(t.dateCreated),
    contractDate: epochToIso(t.contractDate),
    aocAvailable: t.aocDetailsAvailable === true,
    documentCount: typeof t.documentCount === "number" ? t.documentCount : 0,
    sectorNames: Array.isArray(t.sectorNames) ? t.sectorNames : [],
    detailUrl: tenderId ? buildAwardUrl(buyer, tenderId) : undefined,
  };
}

function cleanText(raw: string): string {
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

function buildAwardUrl(buyer: string, tenderId: string): string {
  const slug =
    buyer
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tender";
  return `https://bidassist.com/tender-results/${slug}/detail-${tenderId}`;
}
