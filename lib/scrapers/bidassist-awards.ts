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
 * scraper surfaces *which* tenders are at decision stage and *when* — the
 * winner is filled in later by the BSE-disclosure correlation.
 *
 * Source: the /global-tender-results/active page server-renders a
 * window.__INITIAL_STATE__ blob whose `tenders.content[]` holds the award
 * entities. The SSR page is the only way in — the dedicated
 * /api/bid-award/* endpoints 404 and /api/tender/tenders ignores
 * tenderEntity (it always returns the active-tender feed).
 *
 * The unfiltered results feed is a grab-bag of every government
 * procurement result (10k+ rows, almost none in a watchlist sector), so
 * the scraper does keyword-targeted searches: the page accepts a `label`
 * query param — the same keyword search the active-tenders API uses — and
 * `?label=<term>&page=<n>` returns results matching the term. The scraper
 * first proves `label` actually filters (a nonsense term must return zero
 * rows); if it doesn't, searchParam is reported null so it can be
 * re-checked from the output.
 *
 * Runs ONLY in the GHA scraper (Node). The app imports types only.
 */

import { matchTenderKeywords } from "./sector-keywords";

const RESULTS_PAGE_URL = "https://bidassist.com/global-tender-results/active";

/** Distinctive search terms — one or two per watchlist sector. */
const SEARCH_TERMS = [
  "visa",
  "passport",
  "consular",
  "radar",
  "electronic warfare",
  "aircraft",
  "helicopter",
  "railway electrification",
  "metro rail",
  "freight corridor",
  "transmission line",
  "expressway",
];

/** A term that should match nothing — proves ?label= actually filters. */
const NONSENSE_LABEL = "zqxjvnomatchq";
/** Max result pages to walk per search term. */
const SEARCH_PAGE_CAP = 3;
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
  /** "label" if keyword search filtered the page; null if it didn't. */
  searchParam: string | null;
  /** totalElements reported by the unfiltered results feed. */
  totalAvailable: number | null;
  /** Trimmed __INITIAL_STATE__.pageInfo (url/path/query) from page 0. */
  pageInfo: unknown;
  source: "ssr" | "none";
}

interface FetchOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** Override the search-term list (tests). */
  searchTerms?: string[];
  /** Override the per-term page cap (tests). */
  searchPageCap?: number;
}

type RawAward = Omit<BidAssistAward, "matchedKeywords">;

interface SsrState {
  /** Award rows only — non-award rows are filtered out here. */
  rows: unknown[];
  totalElements: number | null;
  pageInfo: unknown;
}

export async function scrapeBidAssistAwards(
  opts: FetchOptions = {},
): Promise<BidAssistAwardsScrapeResult> {
  const fetcher = opts.fetcher ?? fetch;
  const searchTerms = opts.searchTerms ?? SEARCH_TERMS;
  const searchPageCap = opts.searchPageCap ?? SEARCH_PAGE_CAP;

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

  const finish = (
    searchParam: string | null,
    totalAvailable: number | null,
    pageInfo: unknown,
  ): BidAssistAwardsScrapeResult => {
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
      searchParam,
      totalAvailable,
      pageInfo,
      source: allRows.length > 0 ? "ssr" : "none",
    };
  };

  // Page 0 — the bare results feed. Confirms the page works + carries
  // pageInfo (the pagination/search metadata).
  let first: SsrState;
  try {
    first = await fetchSsrState(fetcher, RESULTS_PAGE_URL, opts.signal);
    pagesFetched++;
  } catch {
    return finish(null, null, null);
  }
  ingest(first.rows);
  if (collected.length === 0) {
    return finish(null, first.totalElements, first.pageInfo);
  }

  // Prove ?label= actually filters: a nonsense term must return nothing.
  let searchWorks = false;
  try {
    await delay(REQUEST_DELAY_MS);
    const probe = await fetchSsrState(fetcher, withParams({ label: NONSENSE_LABEL }), opts.signal);
    pagesFetched++;
    searchWorks = probe.rows.length === 0;
  } catch {
    // leave searchWorks false — fall through with just the bare page
  }

  // Keyword-targeted searches — the only way to surface watchlist awards
  // out of the 10k-row general feed.
  if (searchWorks) {
    for (const term of searchTerms) {
      for (let p = 1; p <= searchPageCap; p++) {
        await delay(REQUEST_DELAY_MS);
        let page: SsrState;
        try {
          page = await fetchSsrState(
            fetcher,
            withParams({ label: term, page: String(p) }),
            opts.signal,
          );
          pagesFetched++;
        } catch {
          break;
        }
        if (ingest(page.rows) === 0) break; // no new rows for this term
      }
    }
  }

  return finish(searchWorks ? "label" : null, first.totalElements, first.pageInfo);
}

/** RESULTS_PAGE_URL with query params applied. */
function withParams(params: Record<string, string>): string {
  const url = new URL(RESULTS_PAGE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
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
      const pageInfo = slimPageInfo(stateObj.pageInfo);
      const tenders = stateObj.tenders;
      if (tenders && typeof tenders === "object") {
        const t = tenders as Record<string, unknown>;
        return {
          rows: (Array.isArray(t.content) ? t.content : []).filter(isAwardRow),
          totalElements: typeof t.totalElements === "number" ? t.totalElements : null,
          pageInfo,
        };
      }
      return { rows: [], totalElements: null, pageInfo };
    } catch (err) {
      lastErr = err;
      await delay(1000 * attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new BidAssistAwardsError(String(lastErr));
}

/** Keep only the small, useful slice of __INITIAL_STATE__.pageInfo. */
function slimPageInfo(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  return { url: p.url ?? null, path: p.path ?? null, query: p.query ?? null };
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
