/**
 * One-shot probe of CPPP endpoints.
 *
 * CPPP's "Latest Active Tenders" page turned out to be a CAPTCHA-gated
 * search form, not a listing. This probe fetches the other menu endpoints
 * and reports — for each — HTTP status, size, whether a CAPTCHA is present,
 * a rough tender-row count, and a text sample. One GHA run tells us which
 * endpoints (if any) are scrapable without solving a CAPTCHA.
 *
 * Output: data/cppp-probe.json  (committed to the data branch).
 * This script + its output are temporary — removed once we pick a source.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

interface Candidate {
  name: string;
  url: string;
  note: string;
}

const CANDIDATES: Candidate[] = [
  {
    name: "by-organisation",
    url: "https://eprocure.gov.in/eprocure/app?page=FrontEndTendersByOrganisation&service=page",
    note: "Org tree drill-down — may be browsable without captcha",
  },
  {
    name: "by-closing-date",
    url: "https://eprocure.gov.in/eprocure/app?page=FrontEndListTendersbyDate&service=page",
    note: "Tenders grouped by closing date",
  },
  {
    name: "bid-awards",
    url: "https://eprocure.gov.in/eprocure/app?page=ResultOfTenders&service=page",
    note: "Results of tenders — who won (the D-day data we want)",
  },
  {
    name: "debarment-list",
    url: "https://eprocure.gov.in/eprocure/app?page=FrontEndDebarmentList&service=page",
    note: "Debarred bidders — direct BLS-style ban signal",
  },
  {
    name: "by-classification",
    url: "https://eprocure.gov.in/eprocure/app?page=FrontEndTendersByClassification&service=page",
    note: "Tenders by product classification",
  },
  {
    name: "cpp-portal-home",
    url: "https://eprocure.gov.in/cppp/",
    note: "CPP publishing portal (separate from the e-proc system)",
  },
];

const HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

interface ProbeResult {
  name: string;
  url: string;
  note: string;
  status: number | null;
  finalUrl?: string;
  bytes: number;
  hasCaptcha: boolean;
  hasSearchForm: boolean;
  tableCount: number;
  trCount: number;
  /** Cheap signal that real tender rows are present. */
  looksLikeTenderList: boolean;
  textSample: string;
  error?: string;
}

async function probe(c: Candidate): Promise<ProbeResult> {
  const base: ProbeResult = {
    name: c.name,
    url: c.url,
    note: c.note,
    status: null,
    bytes: 0,
    hasCaptcha: false,
    hasSearchForm: false,
    tableCount: 0,
    trCount: 0,
    looksLikeTenderList: false,
    textSample: "",
  };
  try {
    const res = await fetch(c.url, { headers: HEADERS, redirect: "follow" });
    const html = await res.text();
    const lower = html.toLowerCase();

    base.status = res.status;
    base.finalUrl = res.url;
    base.bytes = html.length;
    base.hasCaptcha = /captcha/i.test(html);
    base.hasSearchForm = /<input[^>]+type=["']?submit/i.test(html) && /search/i.test(lower);
    base.tableCount = (html.match(/<table/gi) ?? []).length;
    base.trCount = (html.match(/<tr/gi) ?? []).length;
    // Tender listings repeat date strings like "19-May-2026"; >5 of them
    // alongside many rows is a decent "this is a real list" heuristic.
    const dateHits = (html.match(/\d{1,2}-[A-Za-z]{3}-\d{4}/g) ?? []).length;
    base.looksLikeTenderList = dateHits > 5 && base.trCount > 10 && !base.hasCaptcha;
    // Compact text sample: strip tags + collapse whitespace.
    base.textSample = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1200);
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
  }
  return base;
}

async function main() {
  console.log(`Probing ${CANDIDATES.length} CPPP endpoints...`);
  const results: ProbeResult[] = [];
  for (const c of CANDIDATES) {
    const r = await probe(c);
    results.push(r);
    console.log(
      `  ${r.name.padEnd(20)} status=${r.status ?? "ERR"} bytes=${r.bytes} ` +
        `captcha=${r.hasCaptcha} tables=${r.tableCount} tr=${r.trCount} ` +
        `tenderList=${r.looksLikeTenderList}${r.error ? ` error=${r.error}` : ""}`,
    );
    await new Promise((r) => setTimeout(r, 800)); // be polite
  }

  const out = path.resolve("data", "cppp-probe.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(
    out,
    JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2) + "\n",
    "utf8",
  );
  console.log(`\nWrote ${out}`);

  const scrapable = results.filter((r) => r.looksLikeTenderList);
  if (scrapable.length) {
    console.log(`\nScrapable without captcha: ${scrapable.map((r) => r.name).join(", ")}`);
  } else {
    console.log("\nNo captcha-free tender listing found among probed endpoints.");
  }
}

main().catch((err) => {
  console.error("probe-cppp failed:", err);
  process.exit(1);
});
