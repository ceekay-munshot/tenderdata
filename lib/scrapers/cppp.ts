/**
 * CPPP (Central Public Procurement Portal — eprocure.gov.in) scraper.
 *
 * Source page: "Tenders by Closing Date" (FrontEndListTendersbyDate), which
 * defaults to "Closing Today" and serves real tender rows with NO captcha
 * gate. (FrontEndLatestActiveTenders, by contrast, is a captcha-walled
 * search form — see the endpoint probe history.)
 *
 * Verified structure of the real page:
 *   - The tender table is <table id="table" class="list_table">.
 *   - Each tender row is <tr id="informal">, <tr id="informal_0">, ... with
 *     exactly 6 cells: S.No | e-Published | Bid Closing | Tender Opening |
 *     Title(<a>) + refs | Organisation Chain.
 *   - The title sits inside an <a>; the dept ref and the canonical CPPP
 *     tender ID (e.g. 2026_FCI_908269_1) follow it as bracketed text.
 *   - Pagination: <a id="linkLast"> / <a id="linkPage..."> are plain GET
 *     links carrying an "sp=<page>" param. ~10 rows per page.
 *
 * Selecting tr[id^=informal] and requiring a canonical tender ID per row
 * is what keeps header/footer/layout rows out of the result.
 *
 * cheerio-based — runs ONLY in the GHA scraper, never the Worker bundle.
 */

import * as cheerio from "cheerio";
import type { CpppTender } from "@/lib/types";
import { matchTenderKeywords } from "./sector-keywords";

export const CPPP_TENDERS_BY_DATE_URL =
  "https://eprocure.gov.in/eprocure/app?page=FrontEndListTendersbyDate&service=page";

/** Safety cap on pagination — a normal day is ~15-25 pages. */
const MAX_PAGES = 30;
/** Politeness delay between page fetches. */
const PAGE_DELAY_MS = 500;

const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export class CpppFetchError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "CpppFetchError";
  }
}

export interface CpppScrapeResult {
  /** Tenders that matched a watchlist sector keyword. */
  tenders: CpppTender[];
  /** Every parsed row (matchedKeywords may be empty) — for inspection. */
  allRows: CpppTender[];
  /** Count of rows parsed across all pages, before keyword filtering. */
  totalRowsParsed: number;
  /** How many listing pages were fetched. */
  pagesFetched: number;
  /** First page's HTML — caller may persist it for debugging. */
  rawHtml: string;
}

interface FetchOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** Pre-supplied HTML — skips the network and pagination (used by tests). */
  html?: string;
  /** Override the page cap. */
  maxPages?: number;
}

type RawTenderRow = Omit<CpppTender, "matchedKeywords">;

/**
 * Scrape the CPPP "Closing Today" listing across all pages, then
 * keyword-filter to watchlist-relevant tenders.
 */
export async function scrapeLatestTenders(opts: FetchOptions = {}): Promise<CpppScrapeResult> {
  // Test mode: parse the supplied HTML only, no network, no pagination.
  if (opts.html != null) {
    const rows = dedupeByRef(parseTenderTable(opts.html));
    return finalise(rows, 1, opts.html);
  }

  const fetcher = opts.fetcher ?? fetch;
  const maxPages = opts.maxPages ?? MAX_PAGES;

  // Page 1.
  const first = await fetchHtml(CPPP_TENDERS_BY_DATE_URL, fetcher, undefined, opts.signal);
  let rows = parseTenderTable(first.html);

  // Follow GET-based pagination.
  const { lastPage, pageUrl } = parsePagination(first.html);
  let pagesFetched = 1;
  for (let p = 2; p <= Math.min(lastPage, maxPages); p++) {
    const url = pageUrl(p);
    if (!url) break;
    try {
      const next = await fetchHtml(url, fetcher, first.cookie, opts.signal);
      const pageRows = parseTenderTable(next.html);
      if (pageRows.length === 0) break; // empty page — stop early
      rows = rows.concat(pageRows);
      pagesFetched++;
    } catch {
      break; // pagination hiccup — keep what we have
    }
    await delay(PAGE_DELAY_MS);
  }

  return finalise(dedupeByRef(rows), pagesFetched, first.html);
}

function finalise(rows: RawTenderRow[], pagesFetched: number, rawHtml: string): CpppScrapeResult {
  const allRows: CpppTender[] = rows.map((row) => ({
    ...row,
    matchedKeywords: matchTenderKeywords(row.title, row.organisationChain).matchedKeywords,
  }));
  return {
    tenders: allRows.filter((t) => t.matchedKeywords.length > 0),
    allRows,
    totalRowsParsed: rows.length,
    pagesFetched,
    rawHtml,
  };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function fetchHtml(
  url: string,
  fetcher: typeof fetch,
  cookie: string | undefined,
  signal: AbortSignal | undefined,
): Promise<{ html: string; cookie: string | undefined }> {
  const headers: Record<string, string> = { ...REQUEST_HEADERS };
  if (cookie) headers.Cookie = cookie;

  const res = await fetcher(url, { method: "GET", headers, signal });
  if (!res.ok) {
    throw new CpppFetchError(`CPPP responded ${res.status}`, res.status);
  }

  // Carry the JSESSIONID forward so paginated GETs stay in the same session.
  let nextCookie = cookie;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const m = setCookie.match(/JSESSIONID=[^;]+/);
    if (m) nextCookie = m[0];
  }
  return { html: await res.text(), cookie: nextCookie };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

export function parseTenderTable(html: string): RawTenderRow[] {
  const $ = cheerio.load(html);
  const rows: RawTenderRow[] = [];

  // CPPP tender rows are <tr id="informal">, "informal_0", "informal_1"...
  // (The pagination block is <span id="informal_9"> — excluded by the `tr`.)
  $("tr[id^='informal']").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 6) return;

    const cellText = (i: number) => normaliseWhitespace($(cells[i]).text());

    const titleCell = $(cells[4]);
    const link = titleCell.find("a").first();
    const fullText = normaliseWhitespace(titleCell.text());

    // A real tender row always carries a canonical CPPP tender ID.
    const tenderRef = extractTenderRef(fullText);
    if (!tenderRef) return;

    rows.push({
      tenderRef,
      title: extractTitle(normaliseWhitespace(link.text()), fullText),
      organisationChain: cellText(5),
      buyer: firstOrgSegment(cellText(5)),
      publishedAt: parseCpppDate(cellText(1)),
      bidSubmissionCloses: parseCpppDate(cellText(2)),
      tenderOpensAt: parseCpppDate(cellText(3)),
      detailUrl: absoluteUrl(decodeEntities(link.attr("href"))),
    });
  });

  return rows;
}

interface Pagination {
  lastPage: number;
  pageUrl: (n: number) => string | null;
}

/** Read CPPP's table pager: <a id="linkLast"> gives the count, the
 *  <a id="linkPage..."> links give the URL shape. */
function parsePagination(html: string): Pagination {
  const $ = cheerio.load(html);
  const lastHref = decodeEntities($("a#linkLast").attr("href"));
  const tmplHref = decodeEntities($("a[id^='linkPage']").first().attr("href"));

  let lastPage = 1;
  if (lastHref) {
    const nums = [...lastHref.matchAll(/sp=(\d+)/g)].map((m) => Number(m[1]));
    if (nums.length) lastPage = nums[nums.length - 1];
  }

  const pageUrl = (n: number): string | null => {
    if (!tmplHref) return null;
    // Replace the final "sp=<num>" with the requested page.
    const withN = tmplHref.replace(/(sp=)\d+(?![\s\S]*sp=\d+)/, `$1${n}`);
    return absoluteUrl(withN) ?? null;
  };

  return { lastPage, pageUrl };
}

// ---------------------------------------------------------------------------
// field helpers
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parse CPPP's "19-May-2026 03:00 PM" date format -> UTC ISO. */
export function parseCpppDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(
    /(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i,
  );
  if (!m) return null;
  const [, dd, monRaw, yyyy, hhRaw, mmRaw, ssRaw, ampm] = m;
  const month = MONTHS[monRaw.slice(0, 3).toLowerCase()];
  if (month === undefined) return null;

  let hh = hhRaw ? Number(hhRaw) : 0;
  const mm = mmRaw ? Number(mmRaw) : 0;
  const ss = ssRaw ? Number(ssRaw) : 0;
  if (ampm) {
    const upper = ampm.toUpperCase();
    if (upper === "PM" && hh < 12) hh += 12;
    if (upper === "AM" && hh === 12) hh = 0;
  }
  // CPPP times are IST (UTC+5:30).
  const utcMs = Date.UTC(Number(yyyy), month, Number(dd), hh, mm, ss) - 5.5 * 3_600_000;
  const d = new Date(utcMs);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Canonical CPPP tender ID, e.g. 2026_FCI_908269_1 / 2026_ARMHA_908028_1. */
function extractTenderRef(text: string): string {
  const m = text.match(/\b(20\d{2}_[A-Z][A-Z0-9]*_\d{3,8}_\d{1,3})\b/);
  return m ? m[1] : "";
}

/** The title is the <a> text (bracketed); fall back to the first [..] group. */
function extractTitle(linkText: string, fullText: string): string {
  const fromLink = stripOuterBrackets(linkText);
  if (fromLink) return fromLink;
  const m = fullText.match(/\[([^\]]+)\]/);
  return m ? m[1].trim() : fullText;
}

function stripOuterBrackets(s: string): string {
  return s.replace(/^\s*\[/, "").replace(/\]\s*$/, "").trim();
}

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function firstOrgSegment(orgChain: string): string {
  return orgChain.split(/\|\||›|>/)[0]?.trim() || orgChain;
}

function decodeEntities(s?: string): string | undefined {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#36;/g, "$")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function absoluteUrl(href?: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `https://eprocure.gov.in${href}`;
  return `https://eprocure.gov.in/eprocure/${href}`;
}

function dedupeByRef(rows: RawTenderRow[]): RawTenderRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.tenderRef)) return false;
    seen.add(r.tenderRef);
    return true;
  });
}
