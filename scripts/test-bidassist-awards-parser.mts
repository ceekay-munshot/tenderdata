/**
 * Local sanity test for the BidAssist bid-awards scraper.
 *
 * The scraper reads the tender-results page's window.__INITIAL_STATE__
 * blob and does keyword-targeted ?label= searches. Two scenarios:
 *   1. ?label= filters — a nonsense term returns nothing, so the scraper
 *      trusts it and walks each watchlist search term.
 *   2. ?label= is ignored — the nonsense term returns the same feed, so
 *      the scraper reports searchParam=null and stops after the bare page
 *      (no runaway loop).
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
function ssrPage(rows: MockRow[]): string {
  const state = {
    pageInfo: {
      url: "/global-tender-results/active",
      path: "/global-tender-results/active",
      query: { label: "", sort: "RELEVANCE:DESC" },
    },
    tenders: { content: rows.map(awardObj), totalElements: 9999 },
  };
  return `<!doctype html><html><body><script>window.__INITIAL_STATE__ = ${JSON.stringify(
    state,
  )};</script></body></html>`;
}

const RADAR1: MockRow = {
  id: "res-radar-1", ref: "MOD/IAF/2026/9",
  desc: "Supply of surveillance radar system for the naval base",
  buyer: "Indian Navy", src: "EPROCURE", value: 2_480_000_000,
};
const RADAR2: MockRow = {
  id: "res-radar-2", ref: "MOD/AD/2026/4",
  desc: "Air defence radar system procurement and commissioning",
  buyer: "Ministry of Defence", src: "EPROCURE", value: 3_100_000_000,
};
const VISA: MockRow = {
  id: "res-visa-1", ref: "MEA/CONSULAR/2026/MOR",
  desc: "Visa and passport seva outsourcing services, Embassy of India",
  buyer: "Ministry of External Affairs", src: "EPROCURE", value: 845_000_000,
};
const GEN1: MockRow = {
  id: "res-gen-1", ref: "APWD/2026/1",
  desc: "Renovation of school building", buyer: "Public Works Department",
};
const GEN2: MockRow = {
  id: "res-gen-2", ref: "GEM/2026/77",
  desc: "Supply of toner cartridges", buyer: "Some Department",
};

const htmlResponse = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html" } });

/** Scenario 1: ?label= filters. Unknown labels (incl. the nonsense probe) return nothing. */
function searchFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const label = url.searchParams.get("label");
    const page = url.searchParams.get("page");
    if (!label) return htmlResponse(ssrPage([GEN1, GEN2])); // bare page 0
    if (label === "visa" && page === "1") return htmlResponse(ssrPage([VISA]));
    if (label === "radar" && page === "1") return htmlResponse(ssrPage([RADAR1, RADAR2]));
    return htmlResponse(ssrPage([])); // nonsense probe, other terms, later pages
  }) as typeof fetch;
}

/** Scenario 2: ?label= is ignored — the same feed comes back for everything. */
function ignoredFetcher(): typeof fetch {
  return (async () => htmlResponse(ssrPage([GEN1, GEN2]))) as typeof fetch;
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

// --- Scenario 1: keyword search works --------------------------------------
console.log("scenario 1 — ?label= keyword search filters the results:");
const searched = await scrapeBidAssistAwards({
  fetcher: searchFetcher(),
  searchTerms: ["visa", "radar", "aircraft"],
});

assert("source === ssr", searched.source === "ssr", searched.source);
assert("search param detected as 'label'", searched.searchParam === "label", String(searched.searchParam));
// page 0 (GEN1,GEN2) + visa (VISA) + radar (RADAR1,RADAR2) -> 5 unique.
assert("collected across searches: 5 unique awards", searched.totalScanned === 5, `got ${searched.totalScanned}`);
// page0 + nonsense probe + visa(p1,p2) + radar(p1,p2) + aircraft(p1) = 7.
assert("fetch count = 7 (early-breaks on empty pages)", searched.pagesFetched === 7, `got ${searched.pagesFetched}`);
assert("3 matched (visa + 2 radar)", searched.awards.length === 3, `got ${searched.awards.length}`);
assert("generic feed rows dropped by the filter", !searched.awards.some((a) => a.title.includes("school")));

const radar = searched.allRows.find((r) => r.tenderId === "res-radar-1");
assert("title quotes stripped", radar?.title === "Supply of surveillance radar system for the naval base", radar?.title);
assert("awardId mapped from bidAwardId", radar?.awardId === "award-res-radar-1", radar?.awardId);
assert("resultStage mapped", radar?.resultStage === "Potential AOC Released", radar?.resultStage);
assert("resultDate -> ISO", typeof radar?.resultDate === "string" && radar!.resultDate!.startsWith("20"), radar?.resultDate ?? "null");
assert("detail URL points at tender-results", radar?.detailUrl?.startsWith("https://bidassist.com/tender-results/") ?? false, radar?.detailUrl);

// --- Scenario 2: keyword search ignored ------------------------------------
console.log("\nscenario 2 — ?label= ignored, scraper settles for the bare feed:");
const ignored = await scrapeBidAssistAwards({
  fetcher: ignoredFetcher(),
  searchTerms: ["visa", "radar"],
});

assert("searchParam === null", ignored.searchParam === null, String(ignored.searchParam));
assert("no runaway loop — 2 fetches (bare + probe)", ignored.pagesFetched === 2, `got ${ignored.pagesFetched}`);
assert("only the bare page scanned", ignored.totalScanned === 2, `got ${ignored.totalScanned}`);
assert("0 matched — bare feed is all generic", ignored.awards.length === 0, `got ${ignored.awards.length}`);

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
