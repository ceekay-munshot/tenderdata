/**
 * CPPP (Central Public Procurement Portal — eprocure.gov.in) scraper.
 *
 * Unlike BSE there is no JSON API. CPPP is an ASP.NET site that renders
 * tender listings as HTML tables. We scrape the "Latest Active Tenders"
 * page, parse the table with cheerio, and keyword-filter the result down
 * to watchlist-relevant tenders.
 *
 * This module uses cheerio and is meant to run ONLY in the GitHub Actions
 * scraper (Node), never bundled into the Cloudflare Worker. The app should
 * import types from here with `import type`, never the functions.
 *
 * CPPP's HTML changes from time to time, so parsing is deliberately
 * defensive: it maps columns by header text, falls back to positional
 * indices, and the scraper script keeps a raw HTML sample when 0 rows are
 * found so we can fix selectors without guessing.
 */

import * as cheerio from "cheerio";
import type { CpppTender } from "@/lib/types";
import { matchTenderKeywords } from "./sector-keywords";

/**
 * "Tenders by Closing Date" — defaults to "Closing Today" and serves real
 * tender rows with no CAPTCHA gate (verified by the endpoint probe).
 *
 * NOT "FrontEndLatestActiveTenders" — that page is a CAPTCHA-gated search
 * form, it returns no data without solving the captcha.
 */
export const CPPP_TENDERS_BY_DATE_URL =
  "https://eprocure.gov.in/eprocure/app?page=FrontEndListTendersbyDate&service=page";

const REQUEST_HEADERS: HeadersInit = {
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
  tenders: CpppTender[];
  /** Every tender row we parsed, before keyword filtering. */
  totalRowsParsed: number;
  /** The full HTML that was fetched/parsed — the caller decides whether to
   *  persist it for debugging (e.g. when totalRowsParsed looks too low). */
  rawHtml: string;
}

interface FetchOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** Already-downloaded HTML — skips the network call (used by tests). */
  html?: string;
}

/**
 * Fetch + parse the CPPP Latest Active Tenders page, then keyword-filter.
 *
 * Returns only watchlist-relevant tenders, but reports `totalRowsParsed`
 * so the caller can tell "0 relevant" apart from "parser is broken".
 */
export async function scrapeLatestTenders(opts: FetchOptions = {}): Promise<CpppScrapeResult> {
  const html = opts.html ?? (await fetchLatestTendersHtml(opts));
  const all = parseTenderTable(html);

  const tenders: CpppTender[] = [];
  for (const row of all) {
    const match = matchTenderKeywords(row.title, row.organisationChain);
    if (match.matchedKeywords.length === 0) continue;
    tenders.push({ ...row, matchedKeywords: match.matchedKeywords });
  }

  return { tenders, totalRowsParsed: all.length, rawHtml: html };
}

async function fetchLatestTendersHtml(opts: FetchOptions): Promise<string> {
  const fetcher = opts.fetcher ?? fetch;
  const res = await fetcher(CPPP_TENDERS_BY_DATE_URL, {
    method: "GET",
    headers: REQUEST_HEADERS,
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new CpppFetchError(`CPPP responded ${res.status}`, res.status);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

type RawTenderRow = Omit<CpppTender, "matchedKeywords">;

/** Header text -> the logical column it represents. */
const COLUMN_HINTS: { test: RegExp; key: keyof ColumnMap }[] = [
  { test: /e[-\s]?published/i, key: "published" },
  { test: /closing\s*date|submission/i, key: "closing" },
  { test: /opening\s*date/i, key: "opening" },
  { test: /title.*ref|tender\s*id/i, key: "title" },
  { test: /organisation|organization/i, key: "org" },
];

interface ColumnMap {
  published: number;
  closing: number;
  opening: number;
  title: number;
  org: number;
}

const DEFAULT_COLUMNS: ColumnMap = {
  published: 1,
  closing: 2,
  opening: 3,
  title: 4,
  org: 5,
};

export function parseTenderTable(html: string): RawTenderRow[] {
  const $ = cheerio.load(html);
  const rows: RawTenderRow[] = [];

  // CPPP renders the listing in a <table>. There can be several tables on
  // the page (layout/header), so we evaluate each and keep rows that look
  // like real tender rows.
  $("table").each((_, table) => {
    const $table = $(table);

    const headerCells = $table.find("th").length
      ? $table.find("th")
      : $table.find("tr").first().find("td");
    const headerTexts: string[] = [];
    headerCells.each((_, c) => {
      headerTexts.push($(c).text());
    });
    const columns = resolveColumns(headerTexts);

    $table.find("tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length < 5) return; // not a tender row

      const cellText = (i: number) => normaliseWhitespace($(cells[i]).text());

      const titleCell = $(cells[columns.title]);
      const title = normaliseWhitespace(titleCell.text());
      if (!title) return;

      // The title cell holds a link to the detail page + the ref/ID.
      const link = titleCell.find("a").first();
      const href = link.attr("href");
      const tenderRef = extractTenderRef(titleCell.text(), link.text());

      // Skip header rows: a header cell has no parseable dates anywhere.
      const published = parseCpppDate(cellText(columns.published));
      const closing = parseCpppDate(cellText(columns.closing));
      const opening = parseCpppDate(cellText(columns.opening));
      if (!published && !closing && !opening) return;

      rows.push({
        tenderRef: tenderRef || `cppp-${rows.length + 1}`,
        title: stripRefFromTitle(title, tenderRef),
        organisationChain: cellText(columns.org),
        buyer: firstOrgSegment(cellText(columns.org)),
        publishedAt: published,
        bidSubmissionCloses: closing,
        tenderOpensAt: opening,
        detailUrl: absoluteUrl(href),
      });
    });
  });

  return dedupeByRef(rows);
}

/** Map a table's header cell texts to logical column indices. */
function resolveColumns(headerTexts: string[]): ColumnMap {
  if (headerTexts.length >= 5) {
    const map: Partial<ColumnMap> = {};
    headerTexts.forEach((text, i) => {
      for (const hint of COLUMN_HINTS) {
        if (hint.test.test(text)) map[hint.key] = i;
      }
    });
    if (
      map.published != null &&
      map.closing != null &&
      map.opening != null &&
      map.title != null &&
      map.org != null
    ) {
      return map as ColumnMap;
    }
  }
  return DEFAULT_COLUMNS;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse CPPP's date format: "19-May-2026 03:00 PM" (also handles
 * "19-May-2026 15:00" and date-only "19-May-2026").
 */
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
  const utcMs = Date.UTC(Number(yyyy), month, Number(dd), hh, mm, ss) - 5.5 * 3600_000;
  const d = new Date(utcMs);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Pull a tender ID like "2026_MEA_812345_1" out of a cell's text. */
function extractTenderRef(cellText: string, linkText: string): string {
  const candidates = [linkText, cellText];
  for (const c of candidates) {
    const m = c.match(/\b\d{4}[_/][A-Za-z0-9]+[_/]\d+(?:[_/]\d+)?\b/);
    if (m) return m[0];
  }
  // Fallback: bracketed ID "[2026_xxx]"
  const bracket = cellText.match(/\[([^\]]+)\]/);
  return bracket ? bracket[1].trim() : "";
}

function stripRefFromTitle(title: string, ref: string): string {
  let t = title;
  if (ref) t = t.replace(ref, "");
  return normaliseWhitespace(t.replace(/\[\s*\]/g, ""));
}

function firstOrgSegment(orgChain: string): string {
  return orgChain.split(/\|\||›|>|\//)[0]?.trim() || orgChain;
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
