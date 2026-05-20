/**
 * CPPP (Central Public Procurement Portal — eprocure.gov.in) scraper.
 *
 * Source: "Tenders by Closing Date" (FrontEndListTendersbyDate). The page
 * loads "Closing Today" by default; we POST its Tapestry form to switch to
 * "Closing within 14 days" (the LinkSubmit_1 tab) for a forward window,
 * then follow the GET-based pagination. No CAPTCHA on this page.
 *
 * Verified page structure (captured from a live run):
 *   - Tender rows: <tr id="informal">, "informal_0", ... — 6 cells:
 *     S.No | e-Published | Bid Closing | Tender Opening | Title(<a>)+refs |
 *     Organisation Chain.
 *   - The "today/7-day/14-day" tabs are tapestry.form.submit() calls on the
 *     <form id="ListTendersbyDate">; LinkSubmit_1 = "Closing within 14 days".
 *   - Pagination: <a id="linkLast"> / <a id="linkPage..."> GET links with
 *     an sp=<page> param.
 *
 * If the 14-day POST fails for any reason the scraper falls back to the
 * "Closing Today" data it already has, so a run never returns nothing.
 *
 * cheerio-based — runs ONLY in the GHA scraper, never the Worker bundle.
 */

import * as cheerio from "cheerio";
import type { CpppTender } from "@/lib/types";
import { matchTenderKeywords } from "./sector-keywords";

export const CPPP_TENDERS_BY_DATE_URL =
  "https://eprocure.gov.in/eprocure/app?page=FrontEndListTendersbyDate&service=page";
const CPPP_APP_URL = "https://eprocure.gov.in/eprocure/app";

/** The Tapestry submit component for the "Closing within 14 days" tab. */
const FOURTEEN_DAY_SUBMIT = "LinkSubmit_1";

/** Page cap — the 14-day window can be ~150+ pages; we take the soonest. */
const MAX_PAGES = 50;
const PAGE_DELAY_MS = 400;

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

export type CpppViewMode = "today" | "14day";

export interface CpppScrapeResult {
  /** Tenders that matched a watchlist sector keyword. */
  tenders: CpppTender[];
  /** Every parsed row (matchedKeywords may be empty) — for inspection. */
  allRows: CpppTender[];
  /** Count of rows parsed across all pages, before keyword filtering. */
  totalRowsParsed: number;
  /** How many listing pages were fetched. */
  pagesFetched: number;
  /** Whether the 14-day POST succeeded, or we fell back to "today". */
  view: CpppViewMode;
  /** Listing HTML (the view actually used) — caller may persist for debug. */
  rawHtml: string;
}

interface FetchOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** Pre-supplied HTML — skips the network (used by tests). */
  html?: string;
  maxPages?: number;
}

type RawTenderRow = Omit<CpppTender, "matchedKeywords">;

/**
 * Scrape CPPP "Closing within 14 days" (falling back to "Closing Today"),
 * across pages, then keyword-filter to watchlist-relevant tenders.
 */
export async function scrapeLatestTenders(opts: FetchOptions = {}): Promise<CpppScrapeResult> {
  if (opts.html != null) {
    const rows = dedupeByRef(parseTenderTable(opts.html));
    return finalise(rows, 1, opts.html, "today");
  }

  const fetcher = opts.fetcher ?? fetch;
  const maxPages = opts.maxPages ?? MAX_PAGES;

  // Step 1 — GET the base page ("Closing Today" + the Tapestry form).
  const base = await fetchHtml(CPPP_TENDERS_BY_DATE_URL, fetcher, { signal: opts.signal });

  // Step 2 — POST the form to switch to the "Closing within 14 days" tab.
  let listHtml = base.html;
  let cookie = base.cookie;
  let view: CpppViewMode = "today";
  try {
    const fields = extractFormFields(base.html, "#ListTendersbyDate");
    if (fields.length > 0) {
      const posted = await fetchHtml(CPPP_APP_URL, fetcher, {
        method: "POST",
        body: buildWiderWindowBody(fields),
        cookie,
        signal: opts.signal,
      });
      // Accept the wider view only if it actually parsed tender rows.
      if (parseTenderTable(posted.html).length > 0) {
        listHtml = posted.html;
        cookie = posted.cookie;
        view = "14day";
      }
    }
  } catch {
    // Keep the "today" view — never return nothing.
  }

  // Step 3 — parse + follow GET pagination of whichever view we landed on.
  let rows = parseTenderTable(listHtml);
  const { lastPage, pageUrl } = parsePagination(listHtml);
  let pagesFetched = 1;
  for (let p = 2; p <= Math.min(lastPage, maxPages); p++) {
    const url = pageUrl(p);
    if (!url) break;
    try {
      const next = await fetchHtml(url, fetcher, { cookie, signal: opts.signal });
      const pageRows = parseTenderTable(next.html);
      if (pageRows.length === 0) break;
      rows = rows.concat(pageRows);
      pagesFetched++;
    } catch {
      break;
    }
    await delay(PAGE_DELAY_MS);
  }

  return finalise(dedupeByRef(rows), pagesFetched, listHtml, view);
}

function finalise(
  rows: RawTenderRow[],
  pagesFetched: number,
  rawHtml: string,
  view: CpppViewMode,
): CpppScrapeResult {
  const allRows: CpppTender[] = rows.map((row) => ({
    ...row,
    matchedKeywords: matchTenderKeywords(row.title, row.organisationChain).matchedKeywords,
  }));
  return {
    tenders: allRows.filter((t) => t.matchedKeywords.length > 0),
    allRows,
    totalRowsParsed: rows.length,
    pagesFetched,
    view,
    rawHtml,
  };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

interface RequestOpts {
  method?: "GET" | "POST";
  body?: string;
  cookie?: string;
  signal?: AbortSignal;
}

async function fetchHtml(
  url: string,
  fetcher: typeof fetch,
  opts: RequestOpts = {},
): Promise<{ html: string; cookie: string | undefined }> {
  const headers: Record<string, string> = { ...REQUEST_HEADERS };
  if (opts.cookie) headers.Cookie = opts.cookie;
  const method = opts.method ?? "GET";
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";

  const res = await fetcher(url, { method, headers, body: opts.body, signal: opts.signal });
  if (!res.ok) {
    throw new CpppFetchError(`CPPP responded ${res.status}`, res.status);
  }

  // Carry the JSESSIONID forward — the POST view + paginated GETs share it.
  let nextCookie = opts.cookie;
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const m = setCookie.match(/JSESSIONID=[^;]+/);
    if (m) nextCookie = m[0];
  }
  return { html: await res.text(), cookie: nextCookie };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Tapestry form handling
// ---------------------------------------------------------------------------

/** Collect every input/select name+value inside a form (duplicates kept). */
function extractFormFields(html: string, formSelector: string): [string, string][] {
  const $ = cheerio.load(html);
  const pairs: [string, string][] = [];

  $(`${formSelector} input`).each((_, el) => {
    const name = $(el).attr("name");
    if (name) pairs.push([name, $(el).attr("value") ?? ""]);
  });
  $(`${formSelector} select`).each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const value =
      $(el).find("option[selected]").attr("value") ??
      $(el).find("option").first().attr("value") ??
      "";
    pairs.push([name, value]);
  });

  return pairs;
}

/**
 * Build the urlencoded body that submits the form as the "14 days" tab.
 * Tapestry routes the click via the `submitname` hidden field.
 */
function buildWiderWindowBody(fields: [string, string][]): string {
  const params = new URLSearchParams();
  let sawSubmitName = false;
  for (const [name, value] of fields) {
    if (name === "submitname") {
      params.append(name, FOURTEEN_DAY_SUBMIT);
      sawSubmitName = true;
    } else {
      params.append(name, value);
    }
  }
  if (!sawSubmitName) params.append("submitname", FOURTEEN_DAY_SUBMIT);
  return params.toString();
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

export function parseTenderTable(html: string): RawTenderRow[] {
  const $ = cheerio.load(html);
  const rows: RawTenderRow[] = [];

  // Tender rows are <tr id="informal">, "informal_0", "informal_1"...
  // (The pagination block is <span id="informal_9"> — excluded by `tr`.)
  $("tr[id^='informal']").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 6) return;

    const cellText = (i: number) => normaliseWhitespace($(cells[i]).text());

    const titleCell = $(cells[4]);
    const link = titleCell.find("a").first();
    const fullText = normaliseWhitespace(titleCell.text());

    const tenderRef = extractTenderRef(fullText);
    if (!tenderRef) return; // a real tender row always carries a canonical id

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
  const utcMs = Date.UTC(Number(yyyy), month, Number(dd), hh, mm, ss) - 5.5 * 3_600_000;
  const d = new Date(utcMs);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Canonical CPPP tender ID, e.g. 2026_FCI_908269_1 / 2026_ARMHA_908028_1. */
function extractTenderRef(text: string): string {
  const m = text.match(/\b(20\d{2}_[A-Z][A-Z0-9]*_\d{3,8}_\d{1,3})\b/);
  return m ? m[1] : "";
}

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
