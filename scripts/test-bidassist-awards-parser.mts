/**
 * Local sanity test for the BidAssist bid-awards scraper.
 *
 * The scraper reads the tender-results page's window.__INITIAL_STATE__
 * blob and probes the pagination param at runtime. Two scenarios:
 *   1. Pagination works — ?page=N returns fresh awards, so the scraper
 *      detects the param and walks every page.
 *   2. Params ignored — every query returns the same page, so the
 *      scraper settles for a single page (paginationParam = null)
 *      without looping forever.
 *
 * Run:  npx tsx scripts/test-bidassist-awards-parser.mts
 */

import { scrapeBidAssistAwards } from "../lib/scrapers/bidassist-awards.ts";

interface MockRow {
  id: string;
  ref: string;
  desc: string;
  buyer: string;
  src?: string;
  value?: number;
}

/** A TENDER_RESULT-shaped award object. */
function awardObj(o: MockRow) {
  return {
    bidAwardId: `award-${o.id}`,
    sourceBidAwardId: o.id,
    tenderId: o.id,
    bidAwardRefNo: o.ref,
    // BidAssist wraps descriptions in literal quotes — the parser strips them.
    aocDescription: `"${o.desc}"`,
    tenderDetails: `"${o.desc}"`,
    purchaserName: o.buyer,
    displayPurchaserName: `${o.buyer} - Tender Result`,
    procurementSource: o.src ?? "EPROCURE",
    typeOfContract: "WORKS",
    value: o.value ?? 5_000_000,
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
function ssrPage(awards: MockRow[], meta: { totalPages?: number; totalElements?: number } = {}): string {
  const state = {
    pageInfo: { current: "tender-results" },
    tenders: {
      content: awards.map(awardObj),
      totalPages: meta.totalPages ?? 1,
      totalElements: meta.totalElements ?? awards.length,
    },
  };
  return `<!doctype html><html><body><script>window.__INITIAL_STATE__ = ${JSON.stringify(
    state,
  )};</script></body></html>`;
}

const RAILWAY: MockRow = {
  id: "res-rail-1", ref: "CR/ELEC/2026/41",
  desc: "Railway electrification and overhead equipment works, Bhusawal section",
  buyer: "Central Railway", src: "IREPS", value: 1_240_000_000,
};
const VISA: MockRow = {
  id: "res-visa-1", ref: "MEA/CONSULAR/2026/MOR",
  desc: "Visa and passport outsourcing services at Embassy of India, Rabat",
  buyer: "Ministry of External Affairs", src: "EPROCURE", value: 845_000_000,
};
const RADAR: MockRow = {
  id: "res-radar-1", ref: "MOD/IAF/2026/9",
  desc: "Procurement of surveillance radar system for air defence",
  buyer: "Indian Air Force", src: "EPROCURE", value: 2_480_000_000,
};
const NOISE: MockRow = {
  id: "res-noise-1", ref: "GEN/FURN/2026/7",
  desc: "Supply of office furniture and fixtures",
  buyer: "Some Department", src: "GeM",
};

const htmlResponse = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html" } });

/** Scenario 1: ?page=N paginates; ?pageNumber is ignored. totalPages = 2. */
function paginatedFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const page = url.searchParams.get("page");
    let awards: MockRow[];
    if (page === "2") awards = [RADAR, RAILWAY];
    else if (page === null || page === "1") awards = [VISA, NOISE];
    else awards = []; // page 3+
    return htmlResponse(ssrPage(awards, { totalPages: 2, totalElements: 4 }));
  }) as typeof fetch;
}

/** Scenario 2: every query param is ignored — the same page comes back. */
function singlePageFetcher(): typeof fetch {
  return (async () =>
    htmlResponse(ssrPage([VISA, NOISE], { totalPages: 1, totalElements: 2 }))) as typeof fetch;
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

// --- Scenario 1: pagination works ------------------------------------------
console.log("scenario 1 — ?page paginates the tender-results page:");
const paged = await scrapeBidAssistAwards({ fetcher: paginatedFetcher() });

assert("source === ssr", paged.source === "ssr", paged.source);
assert("pagination param detected as 'page'", paged.paginationParam === "page", String(paged.paginationParam));
// bare + ?page=2 probe + walk p1..p2 -> VISA, NOISE, RADAR, RAILWAY de-duped.
assert("de-dupe across pages: 4 unique awards", paged.totalScanned === 4, `got ${paged.totalScanned}`);
assert("totalAvailable read from state", paged.totalAvailable === 4, String(paged.totalAvailable));
assert("3 matched (visa + radar + railway)", paged.awards.length === 3, `got ${paged.awards.length}`);
assert("furniture noise dropped", !paged.awards.some((a) => a.title.includes("furniture")));

const rail = paged.allRows.find((r) => r.tenderId === "res-rail-1");
assert("title quotes stripped", rail?.title === "Railway electrification and overhead equipment works, Bhusawal section", rail?.title);
assert("awardId mapped from bidAwardId", rail?.awardId === "award-res-rail-1", rail?.awardId);
assert("value mapped (INR)", rail?.value === 1_240_000_000, String(rail?.value));
assert("procurementSource mapped", rail?.procurementSource === "IREPS", rail?.procurementSource);
assert("resultStage mapped", rail?.resultStage === "Potential AOC Released", rail?.resultStage);
assert("awardStage mapped", rail?.awardStage === "FINANCIAL_BID_OPENING_DATE", rail?.awardStage);
assert("resultDate -> ISO", typeof rail?.resultDate === "string" && rail!.resultDate!.startsWith("20"), rail?.resultDate ?? "null");
assert("aocAvailable mapped", rail?.aocAvailable === true);
assert("detail URL points at tender-results", rail?.detailUrl?.startsWith("https://bidassist.com/tender-results/") ?? false, rail?.detailUrl);

// --- Scenario 2: pagination params ignored ---------------------------------
console.log("\nscenario 2 — query params ignored, single page only:");
const single = await scrapeBidAssistAwards({ fetcher: singlePageFetcher() });

assert("source === ssr", single.source === "ssr", single.source);
assert("paginationParam === null", single.paginationParam === null, String(single.paginationParam));
assert("no runaway loop — 3 fetches (bare + 2 probes)", single.pagesFetched === 3, `got ${single.pagesFetched}`);
assert("2 awards scanned", single.totalScanned === 2, `got ${single.totalScanned}`);
assert("1 matched (visa)", single.awards.length === 1, `got ${single.awards.length}`);

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
