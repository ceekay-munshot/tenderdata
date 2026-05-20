/**
 * Local sanity test for the BidAssist scraper.
 *
 * Feeds the scraper a page whose markup mirrors bidassist.com — a
 * server-rendered listing with a `window.__INITIAL_STATE__` JSON blob —
 * and asserts the __INITIAL_STATE__ extraction, tender mapping, keyword
 * filter, and pagination.
 *
 * Run:  npx tsx scripts/test-bidassist-parser.mts
 */

import { scrapeBidAssist, extractInitialState, parseInitialState } from "../lib/scrapers/bidassist.ts";

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
    // BidAssist wraps the description in literal quotes — the parser strips them.
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

/** Build a bidassist-shaped page with a __INITIAL_STATE__ blob. */
function page(tenders: MockTender[], pageNumber: number, totalPages: number): string {
  const state = {
    pageInfo: { foo: "bar" },
    tenders: {
      number: pageNumber,
      size: 10,
      totalPages,
      totalElements: totalPages * 10,
      numberOfElements: tenders.length,
      content: tenders.map(tenderObj),
    },
    tenderType: "ACTIVE",
  };
  return `<!DOCTYPE html><html><body>
    <div id="app">listing</div>
    <script>window.__INITIAL_STATE__ = ${JSON.stringify(state)};</script>
  </body></html>`;
}

const RAILWAY: MockTender = {
  id: "uuid-rail-1", ref: "CR/ELEC/2026/41",
  desc: "Railway electrification and overhead equipment works, Bhusawal section",
  buyer: "Central Railway", group: "Railways", src: "IREPS",
  value: 1_240_000_000, sectors: ["Railway Works"],
};
const VISA: MockTender = {
  id: "uuid-visa-1", ref: "MEA/CONSULAR/2026/MOR",
  desc: "Visa and passport outsourcing services at Embassy of India, Rabat",
  buyer: "Ministry of External Affairs", group: "Central Government", src: "CPPP",
  value: 845_000_000, sectors: ["Services"],
};
const NOISE: MockTender = {
  id: "uuid-noise-1", ref: "GEN/FURN/2026/7",
  desc: "Supply of office furniture and fixtures",
  buyer: "Some Department", group: "State", src: "GeM",
  sectors: ["Furniture"],
};
const RADAR: MockTender = {
  id: "uuid-radar-1", ref: "MOD/IAF/2026/9",
  desc: "Procurement of surveillance radar system for air defence",
  buyer: "Indian Air Force", group: "Defence", src: "CPPP",
  value: 2_480_000_000, sectors: ["Defence"],
};

function mockFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const pageNum = Number(new URL(url).searchParams.get("pageNumber") ?? "0");
    const html =
      pageNum === 0
        ? page([RAILWAY, VISA, NOISE], 0, 2)
        : page([RADAR], 1, 2);
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
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

console.log("__INITIAL_STATE__ extraction:");
const html1 = page([RAILWAY, VISA, NOISE], 0, 2);
const state = extractInitialState(html1) as { tenders?: { content?: unknown[] } } | null;
assert("blob extracted (balanced braces, nested location obj)", !!state);
assert("tenders.content present", Array.isArray(state?.tenders?.content));
assert("garbage page -> null", extractInitialState("<html>no blob</html>") === null);

console.log("\ntender mapping:");
const rows = parseInitialState(html1);
assert("3 tenders parsed", rows.length === 3, `got ${rows.length}`);
const rail = rows.find((r) => r.tenderId === "uuid-rail-1");
assert("title quotes stripped", rail?.title === "Railway electrification and overhead equipment works, Bhusawal section", rail?.title);
assert("buyer mapped", rail?.buyer === "Central Railway");
assert("value mapped (INR)", rail?.value === 1_240_000_000);
assert("procurementSource mapped", rail?.procurementSource === "IREPS");
assert("bidDeadline -> ISO", typeof rail?.bidDeadline === "string" && rail.bidDeadline.startsWith("20"));
assert("detail URL built", rail?.detailUrl?.startsWith("https://bidassist.com/global-tenders/") ?? false);

console.log("\nkeyword filter:");
const single = await scrapeBidAssist({ html: html1 });
assert("3 scanned", single.totalScanned === 3);
assert("2 matched (railway + visa)", single.tenders.length === 2, `got ${single.tenders.length}`);
assert("furniture noise dropped", !single.tenders.some((t) => t.title.includes("furniture")));

console.log("\npagination (2 pages via mock fetcher):");
const paged = await scrapeBidAssist({ fetcher: mockFetcher() });
assert("2 pages fetched", paged.pagesFetched === 2, `got ${paged.pagesFetched}`);
assert("4 tenders scanned across pages", paged.totalScanned === 4, `got ${paged.totalScanned}`);
assert(
  "3 matched (railway + visa + radar)",
  paged.tenders.length === 3,
  `got ${paged.tenders.length}: ${paged.tenders.map((t) => t.matchedKeywords.join("/")).join(" | ")}`,
);
assert(
  "radar matched via defence keyword",
  paged.tenders.some((t) => t.matchedKeywords.some((k) => /radar|air defence/.test(k))),
);

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
