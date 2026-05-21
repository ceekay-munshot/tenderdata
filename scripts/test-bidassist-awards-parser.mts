/**
 * Local sanity test for the BidAssist bid-awards scraper.
 *
 * The scraper reads the tender-results page's window.__INITIAL_STATE__
 * blob and keeps awards worth >= Rs 100 crore. It probes for a
 * value-descending `sort`; two scenarios:
 *   1. value sort works  — walks the sorted feed, stops below threshold.
 *   2. value sort ignored — scans the general feed, filters by value.
 *
 * Run:  npx tsx scripts/test-bidassist-awards-parser.mts
 */

import { scrapeBidAssistAwards } from "../lib/scrapers/bidassist-awards.ts";

interface MockRow {
  id: string;
  ref: string;
  desc: string;
  buyer: string;
  value: number;
}

/** A TENDER_RESULT-shaped award object. */
function awardObj(o: MockRow) {
  return {
    bidAwardId: `award-${o.id}`,
    sourceBidAwardId: o.id,
    tenderId: o.id,
    bidAwardRefNo: o.ref,
    aocDescription: `"${o.desc}"`,
    tenderDetails: `"${o.desc}"`,
    purchaserName: o.buyer,
    displayPurchaserName: `${o.buyer} - Tender Result`,
    procurementSource: "EPROCURE",
    typeOfContract: "WORKS",
    value: o.value,
    currency: "INR",
    bidAwardStage: "FINANCIAL_BID_OPENING_DATE",
    bidAwardResultStage: "Potential AOC Released",
    bidAwardStageDate: 1_779_200_100_000,
    postingDate: null,
    dateCreated: 1_777_574_009_485,
    contractDate: 1_993_115_700_000,
    aocDetailsAvailable: true,
    documentCount: 4,
    sectorNames: ["Civil And Construction"],
    location: { state: "Maharashtra", district: "Pune" },
    tenderEntity: "TENDER_RESULT",
  };
}

/** A tender-results page with a window.__INITIAL_STATE__ blob. */
function ssrPage(rows: MockRow[]): string {
  const state = {
    pageInfo: {
      url: "/global-tender-results/active",
      path: "/global-tender-results/active",
      query: { sort: "RELEVANCE:DESC" },
    },
    tenders: { content: rows.map(awardObj), totalElements: 9999 },
  };
  return `<!doctype html><html><body><script>window.__INITIAL_STATE__ = ${JSON.stringify(
    state,
  )};</script></body></html>`;
}

// Eight awards; five clear the Rs 100 Cr (1e9) bar.
const A500: MockRow = { id: "a-500", ref: "R500", desc: "Construction of the coastal expressway corridor", buyer: "NHAI", value: 5_000_000_000 };
const A300: MockRow = { id: "a-300", ref: "R300", desc: "Surveillance radar system installation, naval base", buyer: "Indian Navy", value: 3_000_000_000 };
const A150: MockRow = { id: "a-150", ref: "R150", desc: "Railway electrification of the Bhusawal section", buyer: "Central Railway", value: 1_500_000_000 };
const A120: MockRow = { id: "a-120", ref: "R120", desc: "High-level bridge construction across the river", buyer: "State PWD", value: 1_200_000_000 };
const A100: MockRow = { id: "a-100", ref: "R100", desc: "Supply of 400kV power transformers", buyer: "Power Grid", value: 1_000_000_000 };
const A40: MockRow = { id: "a-40", ref: "R40", desc: "Renovation of a school building", buyer: "Public Works Department", value: 400_000_000 };
const A5: MockRow = { id: "a-5", ref: "R5", desc: "Supply of toner cartridges", buyer: "Some Department", value: 50_000_000 };
const A1: MockRow = { id: "a-1", ref: "R1", desc: "Annual maintenance contract", buyer: "Some Department", value: 10_000_000 };

const VALUE_SORTED = [A500, A300, A150, A120, A100, A40, A5, A1];
const RELEVANCE_ORDER = [A40, A500, A5, A300, A1, A150, A120, A100];
const PAGE = 5;

const htmlResponse = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html" } });

function mockFetcher(valueSortWorks: boolean): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const sort = url.searchParams.get("sort") ?? "";
    const page = Number(url.searchParams.get("page") ?? 1);
    const pool = valueSortWorks && sort.startsWith("VALUE") ? VALUE_SORTED : RELEVANCE_ORDER;
    const slice = pool.slice((page - 1) * PAGE, (page - 1) * PAGE + PAGE);
    return htmlResponse(ssrPage(slice));
  }) as typeof fetch;
}

let failed = 0;
function assert(label: string, cond: unknown, detail?: string) {
  if (cond) console.log(`  PASS  ${label}`);
  else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n--- BidAssist bid-awards scraper local sanity test ---\n");

// --- Scenario 1: value sort works ------------------------------------------
console.log("scenario 1 — results page honours a value-descending sort:");
const sorted = await scrapeBidAssistAwards({ fetcher: mockFetcher(true) });

assert("source === ssr", sorted.source === "ssr", sorted.source);
assert("sortMode === value", sorted.sortMode === "value", sorted.sortMode);
assert("8 awards scanned", sorted.totalScanned === 8, `got ${sorted.totalScanned}`);
assert("5 cleared Rs 100 Cr", sorted.awards.length === 5, `got ${sorted.awards.length}`);
assert("every kept award >= Rs 100 Cr", sorted.awards.every((a) => (a.value ?? 0) >= 1_000_000_000));
assert("sub-threshold awards dropped", !sorted.awards.some((a) => a.tenderId === "a-40" || a.tenderId === "a-5"));

const rail = sorted.allRows.find((r) => r.tenderId === "a-150");
assert("title quotes stripped", rail?.title === "Railway electrification of the Bhusawal section", rail?.title);
assert("value mapped (INR)", rail?.value === 1_500_000_000, String(rail?.value));
assert("resultStage mapped", rail?.resultStage === "Potential AOC Released", rail?.resultStage);
assert("detail URL points at tender-results", rail?.detailUrl?.startsWith("https://bidassist.com/tender-results/") ?? false);

// --- Scenario 2: value sort ignored ----------------------------------------
console.log("\nscenario 2 — no value sort; scan the general feed + filter:");
const scanned = await scrapeBidAssistAwards({ fetcher: mockFetcher(false) });

assert("sortMode === scan", scanned.sortMode === "scan", scanned.sortMode);
assert("8 awards scanned", scanned.totalScanned === 8, `got ${scanned.totalScanned}`);
assert("same 5 cleared Rs 100 Cr", scanned.awards.length === 5, `got ${scanned.awards.length}`);
assert("every kept award >= Rs 100 Cr", scanned.awards.every((a) => (a.value ?? 0) >= 1_000_000_000));

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
