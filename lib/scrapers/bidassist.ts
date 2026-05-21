/**
 * BidAssist (bidassist.com) scraper — the automated multi-portal source.
 *
 * BidAssist is a tender aggregator: it has already de-walled every
 * government portal (CPPP, IREPS, GeM, state e-proc) and normalised them
 * into one feed. Its public JSON API serves the lot — no auth, no captcha.
 *
 *   GET https://api.bidassist.com/api/tender/tenders
 *       ?sort=<MODE>&pageNumber=N&pageSize=S&tenderEntity=TENDER
 *   -> { data: { content: [...tenders], totalPages, totalElements, ... } }
 *
 * The dashboard tracks big, stock-moving tenders, so the scraper keeps
 * only tenders worth >= MIN_VALUE_INR (Rs 100 crore) across every sector
 * — no keyword filter.
 *
 * Strategy: probe for a value-descending `sort` the API honours; if found,
 * walk from the top and stop once tenders drop below the threshold (cheap,
 * complete). If no value sort works, fall back to scanning the general
 * feed and filtering by value afterwards. The result reports which path
 * ran, so the first GHA run doubles as a probe.
 *
 * Runs ONLY in the GHA scraper (Node). The app imports types only.
 */

import { matchTenderKeywords } from "./sector-keywords";

const API_URL = "https://api.bidassist.com/api/tender/tenders";

/** Minimum tender value to keep — Rs 100 crore. */
const MIN_VALUE_INR = 100 * 10_000_000;

/** Candidate value-descending sort tokens (RELEVANCE:DESC is the known default). */
const VALUE_SORT_TOKENS = [
  "VALUE:DESC",
  "TENDER_VALUE:DESC",
  "TENDER_AMOUNT:DESC",
  "AMOUNT:DESC",
];

const PAGE_SIZE = 50;
/** Max pages to walk when a value sort works (stops early below threshold). */
const VALUE_WALK_PAGE_CAP = 30;
/** Max pages to scan when no value sort works. */
const SCAN_PAGE_CAP = 40;
const REQUEST_DELAY_MS = 450;

const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://bidassist.com",
  Referer: "https://bidassist.com/",
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
  sectorNames: string[];
  detailUrl?: string;
  /** Sector keywords this tender's title hit — an informational tag. */
  matchedKeywords: string[];
}

export interface BidAssistScrapeResult {
  /** Tenders worth >= the value threshold. */
  tenders: BidAssistTender[];
  /** Every tender pulled (below-threshold ones included). */
  allRows: BidAssistTender[];
  totalScanned: number;
  apiCalls: number;
  /** "value" = walked a value-sorted feed; "scan" = scanned + filtered. */
  sortMode: "value" | "scan";
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

type RawTender = Omit<BidAssistTender, "matchedKeywords">;

interface ApiPage {
  content: unknown[];
  totalPages: number;
  totalElements: number;
}

export async function scrapeBidAssist(opts: FetchOptions = {}): Promise<BidAssistScrapeResult> {
  const fetcher = opts.fetcher ?? fetch;
  const minValue = opts.minValue ?? MIN_VALUE_INR;
  const walkCap = opts.valueWalkPageCap ?? VALUE_WALK_PAGE_CAP;
  const scanCap = opts.scanPageCap ?? SCAN_PAGE_CAP;

  const rows: RawTender[] = [];
  let apiCalls = 0;

  // 1. Probe for a value-descending sort the API honours.
  let valueSort: string | null = null;
  for (const token of VALUE_SORT_TOKENS) {
    let page: ApiPage;
    try {
      page = await fetchApiPage(fetcher, { pageNumber: 0, sort: token, signal: opts.signal });
      apiCalls++;
    } catch {
      continue;
    }
    await delay(REQUEST_DELAY_MS);
    if (looksValueSorted(page.content, minValue)) {
      valueSort = token;
      rows.push(...page.content.map(mapTender)); // page 0 is already useful
      break;
    }
  }

  if (valueSort) {
    // 2a. Value sort works — walk from the top, stop below the threshold.
    for (let p = 1; p <= walkCap; p++) {
      let page: ApiPage;
      try {
        page = await fetchApiPage(fetcher, { pageNumber: p, sort: valueSort, signal: opts.signal });
        apiCalls++;
      } catch {
        break;
      }
      const mapped = page.content.map(mapTender);
      rows.push(...mapped);
      if (page.content.length === 0) break;
      if (mapped.every((t) => (t.value ?? 0) < minValue)) break;
      await delay(REQUEST_DELAY_MS);
    }
  } else {
    // 2b. Fallback — scan the general feed, filter by value afterwards.
    let totalPages = scanCap;
    for (let p = 0; p < Math.min(scanCap, totalPages); p++) {
      let page: ApiPage;
      try {
        page = await fetchApiPage(fetcher, { pageNumber: p, signal: opts.signal });
        apiCalls++;
      } catch {
        break;
      }
      rows.push(...page.content.map(mapTender));
      if (page.totalPages > 0) totalPages = page.totalPages;
      if (page.content.length === 0) break;
      await delay(REQUEST_DELAY_MS);
    }
  }

  const deduped = dedupe(rows);
  const allRows: BidAssistTender[] = deduped.map((r) => ({
    ...r,
    matchedKeywords: matchTenderKeywords(
      r.title,
      r.buyer,
      r.purchaserGroup,
      r.sectorNames.join(" "),
    ).matchedKeywords,
  }));

  return {
    tenders: allRows.filter((t) => (t.value ?? 0) >= minValue),
    allRows,
    totalScanned: deduped.length,
    apiCalls,
    sortMode: valueSort ? "value" : "scan",
  };
}

/** True if a page's values run high-to-low — i.e. the sort was honoured. */
function looksValueSorted(content: unknown[], minValue: number): boolean {
  const values = content
    .map((c) => (c as RawBidAssistTender)?.value)
    .filter((v): v is number => typeof v === "number" && v > 0);
  if (values.length < 5) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) return false;
  }
  // A genuinely value-sorted feed leads with a tender far above the bar.
  return values[0] >= minValue;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchApiPage(
  fetcher: typeof fetch,
  opts: { pageNumber: number; sort?: string; signal?: AbortSignal },
): Promise<ApiPage> {
  const url = new URL(API_URL);
  url.searchParams.set("sort", opts.sort ?? "RELEVANCE:DESC");
  url.searchParams.set("pageNumber", String(opts.pageNumber));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("tenderEntity", "TENDER");

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetcher(url.toString(), { headers: REQUEST_HEADERS, signal: opts.signal });
      if (!res.ok) throw new BidAssistError(`BidAssist API responded ${res.status}`, res.status);
      const json = (await res.json()) as { data?: Partial<ApiPage> };
      const data = json.data ?? {};
      return {
        content: Array.isArray(data.content) ? data.content : [],
        totalPages: typeof data.totalPages === "number" ? data.totalPages : 0,
        totalElements: typeof data.totalElements === "number" ? data.totalElements : 0,
      };
    } catch (err) {
      lastErr = err;
      await delay(1200 * attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new BidAssistError(String(lastErr));
}

// ---------------------------------------------------------------------------
// tender mapping
// ---------------------------------------------------------------------------

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
  const slug =
    buyer
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
