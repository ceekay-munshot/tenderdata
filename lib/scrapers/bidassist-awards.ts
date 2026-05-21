/**
 * BidAssist bid-awards (tender results) scraper.
 *
 * BidAssist's "tender results" product tracks tenders past the bidding
 * phase — financial-bid opening, AOC (Award of Contract) release. Each
 * award entity carries the result stage, the result date, value and
 * buyer: the "a result is coming — here's when" signal.
 *
 * IMPORTANT: the public listing does NOT name the winning bidder. The
 * winner lives inside the paywalled AOC document — it's filled in later by
 * the BSE-disclosure correlation.
 *
 * Source: the /global-tender-results/active page server-renders a
 * window.__INITIAL_STATE__ blob whose `tenders.content[]` holds the award
 * entities. (The SSR page is the only way in — the /api/bid-award/*
 * endpoints 404 and /api/tender/tenders ignores tenderEntity.)
 *
 * The dashboard tracks big, stock-moving tenders, so the scraper keeps
 * only results worth >= MIN_VALUE_INR (Rs 100 crore), across every sector.
 * Strategy: probe for a value-descending `sort` the page honours; if
 * found, walk from the top and stop below the threshold; otherwise scan
 * the general feed and filter by value. The result reports which path ran.
 *
 * Runs ONLY in the GHA scraper (Node). The app imports types only.
 */

import { matchTenderKeywords } from "./sector-keywords";

const RESULTS_PAGE_URL = "https://bidassist.com/global-tender-results/active";

/** Minimum contract value to keep — Rs 100 crore. */
const MIN_VALUE_INR = 100 * 10_000_000;

/** Candidate value-descending sort tokens (the page defaults to RELEVANCE:DESC). */
const VALUE_SORT_TOKENS = [
  "VALUE:DESC",
  "TENDER_VALUE:DESC",
  "TENDER_AMOUNT:DESC",
  "AMOUNT:DESC",
];

/** Max pages to walk when a value sort works (stops early below threshold). */
const VALUE_WALK_PAGE_CAP = 30;
/** Max pages to scan when no value sort works. */
const SCAN_PAGE_CAP = 25;
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
  /** Sector keywords this award's title hit — an informational tag. */
  matchedKeywords: string[];
}

export interface BidAssistAwardsScrapeResult {
  /** Awards worth >= the value threshold. */
  awards: BidAssistAward[];
  /** Every award pulled (below-threshold ones included). */
  allRows: BidAssistAward[];
  totalScanned: number;
  /** Result pages actually fetched. */
  pagesFetched: number;
  /** "value" = walked a value-sorted feed; "scan" = scanned + filtered. */
  sortMode: "value" | "scan";
  /** totalElements reported by the results feed. */
  totalAvailable: number | null;
  /** Trimmed __INITIAL_STATE__.pageInfo (url/path/query). */
  pageInfo: unknown;
  source: "ssr" | "none";
}

interface FetchOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** Override the value threshold (tests). */
  minValue?: number;
  /** Override the value-walk page cap (tests). */
  valueWalkPageCap?: number;
  /** Override the scan page cap (tests). */
  scanPageCap?: number;
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
  const minValue = opts.minValue ?? MIN_VALUE_INR;
  const walkCap = opts.valueWalkPageCap ?? VALUE_WALK_PAGE_CAP;
  const scanCap = opts.scanPageCap ?? SCAN_PAGE_CAP;

  const collected: unknown[] = [];
  const seen = new Set<string>();
  let pagesFetched = 0;
  let pageInfo: unknown = null;
  let totalAvailable: number | null = null;

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

  // 1. Probe for a value-descending sort the page honours.
  let valueSort: string | null = null;
  for (const token of VALUE_SORT_TOKENS) {
    let state: SsrState;
    try {
      state = await fetchSsrState(fetcher, awardsUrl({ sort: token, page: 1 }), opts.signal);
      pagesFetched++;
    } catch {
      continue;
    }
    if (pageInfo === null) {
      pageInfo = state.pageInfo;
      totalAvailable = state.totalElements;
    }
    await delay(REQUEST_DELAY_MS);
    if (looksValueSorted(state.rows, minValue)) {
      valueSort = token;
      ingest(state.rows);
      break;
    }
  }

  if (valueSort) {
    // 2a. Value sort works — walk from the top, stop below the threshold.
    for (let p = 2; p <= walkCap; p++) {
      let state: SsrState;
      try {
        state = await fetchSsrState(
          fetcher,
          awardsUrl({ sort: valueSort, page: p }),
          opts.signal,
        );
        pagesFetched++;
      } catch {
        break;
      }
      const added = ingest(state.rows);
      if (state.rows.length === 0 || added === 0) break;
      if (state.rows.every((r) => awardValue(r) < minValue)) break;
      await delay(REQUEST_DELAY_MS);
    }
  } else {
    // 2b. Fallback — scan the general feed, filter by value afterwards.
    for (let p = 1; p <= scanCap; p++) {
      let state: SsrState;
      try {
        state = await fetchSsrState(fetcher, awardsUrl({ page: p }), opts.signal);
        pagesFetched++;
      } catch {
        break;
      }
      if (pageInfo === null) {
        pageInfo = state.pageInfo;
        totalAvailable = state.totalElements;
      }
      const added = ingest(state.rows);
      if (state.rows.length === 0 || added === 0) break;
      await delay(REQUEST_DELAY_MS);
    }
  }

  const allRows: BidAssistAward[] = collected.map(mapAward).map((r) => ({
    ...r,
    matchedKeywords: matchTenderKeywords(r.title, r.buyer, "", r.sectorNames.join(" "))
      .matchedKeywords,
  }));

  return {
    awards: allRows.filter((a) => (a.value ?? 0) >= minValue),
    allRows,
    totalScanned: allRows.length,
    pagesFetched,
    sortMode: valueSort ? "value" : "scan",
    totalAvailable,
    pageInfo,
    source: allRows.length > 0 ? "ssr" : "none",
  };
}

/** RESULTS_PAGE_URL with optional sort + page query params. */
function awardsUrl(params: { sort?: string; page?: number }): string {
  const url = new URL(RESULTS_PAGE_URL);
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (params.page) url.searchParams.set("page", String(params.page));
  return url.toString();
}

/** True if a page's award values run high-to-low — i.e. the sort was honoured. */
function looksValueSorted(rows: unknown[], minValue: number): boolean {
  const values = rows
    .map(awardValue)
    .filter((v) => v > 0);
  if (values.length < 5) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) return false;
  }
  return values[0] >= minValue;
}

function awardValue(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const v = (raw as { value?: unknown }).value;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
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
