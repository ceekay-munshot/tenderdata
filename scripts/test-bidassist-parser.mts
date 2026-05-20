/**
 * Local sanity test for the BidAssist scraper.
 *
 * The scraper hits the api.bidassist.com JSON API
 * (/api/tender/tenders -> { data: { content: [...] } }). A mock fetcher
 * returns that shape and routes by the `label` search param, so the test
 * exercises keyword search, the general feed, de-dupe, mapping, and the
 * keyword filter.
 *
 * Run:  npx tsx scripts/test-bidassist-parser.mts
 */

import { scrapeBidAssist } from "../lib/scrapers/bidassist.ts";

interface MockTender {
  id: string;
  ref: string;
  desc: string;
  buyer: string;
  group?: string;
  src?: string;
  value?: number;
  sectors?: string[];
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
    purchaserGroup: o.group ?? "",
    procurementSource: o.src ?? "CPPP",
    value: o.value ?? 10_000_000,
    emd: 100_000,
    bidDeadLine: 1_781_861_400_000,
    postingDate: 1_779_200_100_000,
    sectorNames: o.sectors ?? ["Civil And Construction"],
    location: { state: "Maharashtra", district: "Pune" },
  };
}

/** The api.bidassist.com JSON envelope: { data: { content, totalPages, ... } }. */
function apiResponse(tenders: MockTender[]): string {
  return JSON.stringify({
    success: true,
    data: {
      number: 0,
      size: 50,
      totalPages: 1,
      totalElements: tenders.length,
      numberOfElements: tenders.length,
      content: tenders.map(tenderObj),
    },
  });
}

const RAILWAY: MockTender = {
  id: "uuid-rail-1", ref: "CR/ELEC/2026/41",
  desc: "Railway electrification and overhead equipment works, Bhusawal section",
  buyer: "Central Railway", group: "Railways", src: "IREPS", value: 1_240_000_000,
};
const VISA: MockTender = {
  id: "uuid-visa-1", ref: "MEA/CONSULAR/2026/MOR",
  desc: "Visa and passport outsourcing services at Embassy of India, Rabat",
  buyer: "Ministry of External Affairs", group: "Central Government", src: "CPPP", value: 845_000_000,
};
const RADAR: MockTender = {
  id: "uuid-radar-1", ref: "MOD/IAF/2026/9",
  desc: "Procurement of surveillance radar system for air defence",
  buyer: "Indian Air Force", group: "Defence", src: "CPPP", value: 2_480_000_000,
};
const NOISE: MockTender = {
  id: "uuid-noise-1", ref: "GEN/FURN/2026/7",
  desc: "Supply of office furniture and fixtures",
  buyer: "Some Department", group: "State", src: "GeM",
};

/** Routes by the `label` search param; general feed (no label) returns a mix. */
function mockFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const label = url.searchParams.get("label");
    let tenders: MockTender[];
    if (label === "visa") tenders = [VISA];
    else if (label === "radar") tenders = [RADAR];
    else if (label) tenders = []; // other search terms: no hits
    else tenders = [RAILWAY, NOISE, VISA]; // general feed (VISA overlaps the search)
    return new Response(apiResponse(tenders), {
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

console.log("\n--- BidAssist scraper local sanity test ---\n");

const result = await scrapeBidAssist({
  fetcher: mockFetcher(),
  searchTerms: ["visa", "radar", "expressway"],
  generalPages: 1,
});

console.log("api calls + scanning:");
assert("4 API calls (3 searches + 1 general page)", result.apiCalls === 4, `got ${result.apiCalls}`);
// 5 rows collected (visa, radar, railway, noise, visa-again) -> VISA de-duped -> 4 unique.
assert("de-dupe: 4 unique tenders", result.totalScanned === 4, `got ${result.totalScanned}`);

console.log("\nkeyword filter:");
assert("3 matched (visa + radar + railway)", result.tenders.length === 3, `got ${result.tenders.length}`);
assert(
  "furniture noise dropped",
  !result.tenders.some((t) => t.title.includes("furniture")),
);
assert(
  "radar matched via a defence keyword",
  result.tenders.some((t) => t.matchedKeywords.some((k) => /radar|air defence/.test(k))),
);

console.log("\ntender mapping:");
const rail = result.allRows.find((r) => r.tenderId === "uuid-rail-1");
assert("title quotes stripped", rail?.title === "Railway electrification and overhead equipment works, Bhusawal section", rail?.title);
assert("buyer mapped", rail?.buyer === "Central Railway");
assert("value mapped (INR)", rail?.value === 1_240_000_000);
assert("procurementSource mapped", rail?.procurementSource === "IREPS");
assert("bidDeadline -> ISO", typeof rail?.bidDeadline === "string" && rail!.bidDeadline!.startsWith("20"));
assert("detail URL built", rail?.detailUrl?.startsWith("https://bidassist.com/global-tenders/") ?? false);

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
