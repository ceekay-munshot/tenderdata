/**
 * BidAssist (bidassist.com) scraper — the automated multi-portal source.
 *
 * BidAssist is a tender aggregator: it has already de-walled every
 * government portal (CPPP, IREPS, GeM, state e-proc) and normalised them
 * into one feed. Its public JSON API serves the lot — no auth, no captcha,
 * no OTP.
 *
 *   GET https://api.bidassist.com/api/tender/tenders
 *       ?sort=RELEVANCE:DESC&pageNumber=N&pageSize=S&tenderEntity=TENDER
 *       [&label=<keyword>]
 *   -> { data: { content: [...tenders], totalPages, totalElements, ... } }
 *
 * Strategy: run a keyword search (label=) per watchlist sector term to
 * pull targeted tenders, plus a few pages of the general feed as a
 * baseline, then de-dupe and keyword-filter. If `label` turns out to be
 * ignored, the searches just return the general feed and de-dupe absorbs
 * it — the scrape still works.
 *
 * Runs ONLY in the GHA scraper (Node). The app imports types only.
 */

import { matchTenderKeywords } from "./sector-keywords";

const API_URL = "https://api.bidassist.com/api/tender/tenders";

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

const PAGE_SIZE = 50;
/** Pages of the general (unfiltered) feed to pull as a baseline. */
const GENERAL_PAGES = 4;
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
  /** Watchlist sector keywords this tender matched. */
  matchedKeywords: string[];
}

export interface BidAssistScrapeResult {
  /** Tenders that matched a watchlist sector keyword. */
  tenders: BidAssistTender[];
  /** Every tender pulled (matchedKeywords may be empty). */
  allRows: BidAssistTender[];
  totalScanned: number;
  apiCalls: number;
}

interface FetchOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** Override the search-term list (tests). */
  searchTerms?: string[];
  /** Override the general-feed page count. */
  generalPages?: number;
}

type RawTender = Omit<BidAssistTender, "matchedKeywords">;

interface ApiPage {
  content: unknown[];
  totalPages: number;
  totalElements: number;
}

export async function scrapeBidAssist(opts: FetchOptions = {}): Promise<BidAssistScrapeResult> {
  const fetcher = opts.fetcher ?? fetch;
  const searchTerms = opts.searchTerms ?? SEARCH_TERMS;
  const generalPages = opts.generalPages ?? GENERAL_PAGES;

  const rows: RawTender[] = [];
  let apiCalls = 0;

  // 1. Keyword searches — targeted, high-yield.
  for (const term of searchTerms) {
    try {
      const page = await fetchApiPage(fetcher, { pageNumber: 0, label: term, signal: opts.signal });
      apiCalls++;
      rows.push(...page.content.map(mapTender));
    } catch {
      // skip this term — one failure shouldn't sink the run
    }
    await delay(REQUEST_DELAY_MS);
  }

  // 2. General feed — a baseline of the most relevant recent tenders.
  let totalPages = generalPages;
  for (let p = 0; p < Math.min(generalPages, totalPages); p++) {
    try {
      const page = await fetchApiPage(fetcher, { pageNumber: p, signal: opts.signal });
      apiCalls++;
      rows.push(...page.content.map(mapTender));
      if (page.totalPages > 0) totalPages = page.totalPages;
      if (page.content.length === 0) break;
    } catch {
      break;
    }
    await delay(REQUEST_DELAY_MS);
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
    tenders: allRows.filter((t) => t.matchedKeywords.length > 0),
    allRows,
    totalScanned: deduped.length,
    apiCalls,
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchApiPage(
  fetcher: typeof fetch,
  opts: { pageNumber: number; label?: string; signal?: AbortSignal },
): Promise<ApiPage> {
  const url = new URL(API_URL);
  url.searchParams.set("sort", "RELEVANCE:DESC");
  url.searchParams.set("pageNumber", String(opts.pageNumber));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("tenderEntity", "TENDER");
  if (opts.label) url.searchParams.set("label", opts.label);

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
