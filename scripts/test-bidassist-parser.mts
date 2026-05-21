/**
 * Local sanity test for the BidAssist active-tenders scraper.
 *
 * The scraper keeps tenders worth >= Rs 100 crore. It first probes for a
 * value-descending `sort` the API honours; two scenarios:
 *   1. value sort works  — walks the sorted feed, stops below threshold.
 *   2. value sort ignored — scans the general feed, filters by value.
 * Either way the >= Rs 100 Cr set must come out identical.
 *
 * Run:  npx tsx scripts/test-bidassist-parser.mts
 */

import { scrapeBidAssist } from "../lib/scrapers/bidassist.ts";

interface MockTender {
  id: string;
  ref: string;
  desc: string;
  buyer: string;
  value: number;
}

function tenderObj(o: MockTender) {
  return {
    tenderId: o.id,
    tenderNoticeNo: o.ref,
    sourceTenderId: `SRC/${o.ref}`,
    // BidAssist wraps descriptions in literal quotes — the parser strips them.
    tenderDescription: `"${o.desc}"`,
    tenderDetails: `"${o.desc}"`,
    purchaserName: o.buyer,
    displayPurchaserName: `${o.buyer} - Tender`,
    purchaserGroup: "",
    procurementSource: "CPPP",
    value: o.value,
    emd: 100_000,
    bidDeadLine: 1_781_861_400_000,
    postingDate: 1_779_200_100_000,
    sectorNames: ["Civil And Construction"],
    location: { state: "Maharashtra", district: "Pune" },
  };
}

/** The api.bidassist.com JSON envelope: { data: { content, totalPages, ... } }. */
function apiResponse(tenders: MockTender[]): string {
  return JSON.stringify({
    success: true,
    data: { number: 0, size: 50, totalPages: 2, totalElements: tenders.length, content: tenders.map(tenderObj) },
  });
}

// Eight tenders; five clear the Rs 100 Cr (1e9) bar.
const T500: MockTender = { id: "t-500", ref: "R500", desc: "Construction of 6-lane access-controlled expressway, Package 3", buyer: "NHAI", value: 5_000_000_000 };
const T300: MockTender = { id: "t-300", ref: "R300", desc: "Surveillance radar system supply for naval command", buyer: "Indian Navy", value: 3_000_000_000 };
const T150: MockTender = { id: "t-150", ref: "R150", desc: "Railway electrification of the Itarsi-Bhusawal section", buyer: "Central Railway", value: 1_500_000_000 };
const T120: MockTender = { id: "t-120", ref: "R120", desc: "Construction of a high-level bridge across the Godavari", buyer: "State PWD", value: 1_200_000_000 };
const T100: MockTender = { id: "t-100", ref: "R100", desc: "Supply and installation of 400kV power transformers", buyer: "Power Grid", value: 1_000_000_000 };
const T40: MockTender = { id: "t-40", ref: "R40", desc: "Renovation of the district hospital ward", buyer: "Health Department", value: 400_000_000 };
const T5: MockTender = { id: "t-5", ref: "R5", desc: "Supply of office furniture", buyer: "Some Department", value: 50_000_000 };
const T1: MockTender = { id: "t-1", ref: "R1", desc: "Annual maintenance of photocopiers", buyer: "Some Department", value: 10_000_000 };

const VALUE_SORTED = [T500, T300, T150, T120, T100, T40, T5, T1];
const RELEVANCE_ORDER = [T40, T500, T5, T300, T1, T150, T120, T100];
const PAGE = 5;

function mockFetcher(valueSortWorks: boolean): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const sort = url.searchParams.get("sort") ?? "";
    const pageNumber = Number(url.searchParams.get("pageNumber") ?? 0);
    const pool = valueSortWorks && sort.startsWith("VALUE") ? VALUE_SORTED : RELEVANCE_ORDER;
    const slice = pool.slice(pageNumber * PAGE, pageNumber * PAGE + PAGE);
    return new Response(apiResponse(slice), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
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

console.log("\n--- BidAssist active-tenders scraper local sanity test ---\n");

// --- Scenario 1: value sort works ------------------------------------------
console.log("scenario 1 — API honours a value-descending sort:");
const sorted = await scrapeBidAssist({ fetcher: mockFetcher(true) });

assert("sortMode === value", sorted.sortMode === "value", sorted.sortMode);
assert("8 tenders scanned", sorted.totalScanned === 8, `got ${sorted.totalScanned}`);
assert("5 cleared Rs 100 Cr", sorted.tenders.length === 5, `got ${sorted.tenders.length}`);
assert("every kept tender >= Rs 100 Cr", sorted.tenders.every((t) => (t.value ?? 0) >= 1_000_000_000));
assert("sub-threshold tenders dropped", !sorted.tenders.some((t) => t.id === "t-40" || t.id === "t-5"));

const rail = sorted.allRows.find((r) => r.tenderId === "t-150");
assert("title quotes stripped", rail?.title === "Railway electrification of the Itarsi-Bhusawal section", rail?.title);
assert("value mapped (INR)", rail?.value === 1_500_000_000, String(rail?.value));
assert("detail URL built", rail?.detailUrl?.startsWith("https://bidassist.com/global-tenders/") ?? false);

// --- Scenario 2: value sort ignored ----------------------------------------
console.log("\nscenario 2 — no value sort; scan the general feed + filter:");
const scanned = await scrapeBidAssist({ fetcher: mockFetcher(false) });

assert("sortMode === scan", scanned.sortMode === "scan", scanned.sortMode);
assert("8 tenders scanned", scanned.totalScanned === 8, `got ${scanned.totalScanned}`);
assert("same 5 cleared Rs 100 Cr", scanned.tenders.length === 5, `got ${scanned.tenders.length}`);
assert("every kept tender >= Rs 100 Cr", scanned.tenders.every((t) => (t.value ?? 0) >= 1_000_000_000));

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
