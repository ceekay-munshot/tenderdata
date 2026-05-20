/**
 * Local sanity test for the CPPP scraper.
 *
 * Mirrors the real eprocure.gov.in "Tenders by Closing Date" markup:
 * <tr id="informal"> rows, a Tapestry <form id="ListTendersbyDate">,
 * GET-based pagination. A mock fetcher exercises the GET base page ->
 * POST "14-day" switch -> paginated GETs flow.
 *
 * Run:  npx tsx scripts/test-cppp-parser.mts
 */

import { scrapeLatestTenders, parseCpppDate, parseTenderTable } from "../lib/scrapers/cppp.ts";

interface Row {
  sno: string;
  published: string;
  closing: string;
  opening: string;
  title: string;
  deptRef: string;
  tenderId: string;
  org: string;
}

function row(r: Row, idx: number): string {
  const id = idx === 0 ? "informal" : `informal_${idx}`;
  return `
  <tr class="${idx % 2 ? "odd" : "even"}" id="${id}">
    <td align="center">${r.sno}</td>
    <td align="center">${r.published}</td>
    <td align="center">${r.closing}</td>
    <td align="center">${r.opening}</td>
    <td align="center"><a id="DirectLink_${idx}" href="/eprocure/app?component=%24DirectLink&amp;page=FrontEndListTendersbyDate&amp;service=direct&amp;session=T&amp;sp=Stoken${idx}">[${r.title}]</a>
      [${r.deptRef}][${r.tenderId}]
    </td>
    <td align="center">${r.org}</td>
  </tr>`;
}

/** Build a CPPP listing page: the Tapestry form, tender table, pagination. */
function page(rows: Row[], currentPage: number, lastPage: number): string {
  const pager =
    lastPage > 1
      ? `<span id="informal_9"><b>${currentPage}</b>
         <a id="linkPage" href="/eprocure/app?component=%24TablePages.linkPage&amp;page=FrontEndListTendersbyDate&amp;service=direct&amp;session=T&amp;sp=AFrontEndListTendersbyDate%2Ctable&amp;sp=2">2</a>
         <a id="linkLast" href="/eprocure/app?component=%24TablePages.linkLast&amp;page=FrontEndListTendersbyDate&amp;service=direct&amp;session=T&amp;sp=AFrontEndListTendersbyDate%2Ctable&amp;sp=${lastPage}">&gt;&gt;</a>
         </span>`
      : "";
  return `<html><body>
    <table id="layout"><tr><td>chrome</td></tr></table>
    <form method="post" action="/eprocure/app" id="ListTendersbyDate">
      <div style="display:none;" id="ListTendersbyDatehidden">
        <input type="hidden" name="formids" value="tokenSecret,typeSearch,LinkSubmit_1,submitname" />
        <input type="hidden" name="seedids" value="MOCKSEED==" />
        <input type="hidden" name="component" value="ListTendersbyDate" />
        <input type="hidden" name="page" value="FrontEndListTendersbyDate" />
        <input type="hidden" name="service" value="direct" />
        <input type="hidden" name="session" value="T" />
        <input type="hidden" name="submitmode" value="" />
        <input type="hidden" name="submitname" value="" />
        <input type="hidden" name="tokenSecret" value="MOCKTOKEN" />
      </div>
      <select name="typeSearch"><option value="0" selected="selected">Bid Submission Closing</option></select>
      <table id="table" class="list_table">
        <tr class="list_header">
          <td>S.No</td><td>e-Published Date</td><td>Bid Submission Closing Date</td>
          <td>Tender Opening Date</td><td>Title and Ref.No./Tender ID</td><td>Organisation Chain</td>
        </tr>
        ${rows.map(row).join("\n")}
        <tr><td class="list_footer" colspan="8">${pager}</td></tr>
      </table>
    </form>
    <tr class="footer"><td>Designed, Developed and Hosted by National Informatics Centre</td></tr>
  </body></html>`;
}

// "Closing Today" — what a bare GET returns. Small, non-watchlist.
const TODAY: Row[] = [
  {
    sno: "1.", published: "12-May-2026 09:00 AM", closing: "20-May-2026 09:00 AM",
    opening: "21-May-2026 11:00 AM",
    title: "Comprehensive Annual Maintenance Contract",
    deptRef: "CAMC/ELWB/2026", tenderId: "2026_FCI_908269_1",
    org: "Food Corporation of India||Regional Office Assam",
  },
];

// "Closing within 14 days" page 1 — what the POST returns.
const WIDE_P1: Row[] = [
  {
    sno: "1.", published: "07-May-2026 12:10 PM", closing: "26-May-2026 05:00 PM",
    opening: "27-May-2026 11:30 AM",
    title: "Provision of Visa and Passport outsourcing services at Embassy of India",
    deptRef: "MEA/CONSULAR/2026/MOR", tenderId: "2026_MEA_812345_1",
    org: "Ministry of External Affairs||Consular Passport and Visa Division",
  },
  {
    sno: "2.", published: "09-May-2026 02:00 PM", closing: "28-May-2026 04:00 PM",
    opening: "23-Jun-2026 11:00 AM",
    title: "Construction of rural road and culverts in Rewa district",
    deptRef: "PWD/RWA/2026", tenderId: "2026_PWD_440022_1",
    org: "Madhya Pradesh PWD||Rewa Division",
  },
];

// "Closing within 14 days" page 2 — what a paginated GET returns.
const WIDE_P2: Row[] = [
  {
    sno: "3.", published: "10-May-2026 10:00 AM", closing: "30-May-2026 03:00 PM",
    opening: "09-Jun-2026 11:30 AM",
    title: "Supply of Light Mountain Radar systems for Air Defence",
    deptRef: "MOD/IAF/RADAR/2026", tenderId: "2026_MOD_777001_2",
    org: "Ministry of Defence||Indian Air Force",
  },
  {
    sno: "4.", published: "08-May-2026 11:00 AM", closing: "01-Jun-2026 05:00 PM",
    opening: "22-Jun-2026 11:30 AM",
    title: "Railway electrification and overhead equipment works, Bhusawal section",
    deptRef: "RAIL/CR/2026", tenderId: "2026_RAIL_990011_3",
    org: "Ministry of Railways||Central Railway",
  },
];

/** GET base -> today; POST -> 14-day p1; GET sp=2 -> 14-day p2. */
function mockFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    let html: string;
    if (method === "POST") html = page(WIDE_P1, 1, 2);
    else if (/sp=2\b/.test(url)) html = page(WIDE_P2, 2, 2);
    else html = page(TODAY, 1, 1);
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  }) as typeof fetch;
}

/** A fetcher whose POST fails — exercises the fallback to "today". */
function postFailsFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST") return new Response("error", { status: 500 });
    return new Response(page(TODAY, 1, 1), { status: 200, headers: { "content-type": "text/html" } });
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

console.log("\n--- CPPP scraper local sanity test ---\n");

console.log("date parsing:");
assert(
  "'19-May-2026 03:00 PM' -> 09:30 UTC",
  parseCpppDate("19-May-2026 03:00 PM") === "2026-05-19T09:30:00.000Z",
  parseCpppDate("19-May-2026 03:00 PM") ?? "null",
);
assert("garbage returns null", parseCpppDate("not a date") === null);

console.log("\nrow parsing:");
const rawRows = parseTenderTable(page(WIDE_P1, 1, 2));
assert("2 informal rows parsed (header/footer skipped)", rawRows.length === 2, `got ${rawRows.length}`);
const visa = rawRows.find((r) => r.tenderRef === "2026_MEA_812345_1");
assert("canonical tender ref extracted", !!visa);
assert("title from <a>, brackets stripped", visa?.title.startsWith("Provision of Visa"), visa?.title);
assert("buyer = first org segment", visa?.buyer === "Ministry of External Affairs", visa?.buyer);
assert("detail URL absolutised + decoded", (visa?.detailUrl?.startsWith("https://eprocure.gov.in") && !visa.detailUrl.includes("&amp;")) ?? false);
assert("dates parsed", !!visa?.publishedAt && !!visa?.bidSubmissionCloses && !!visa?.tenderOpensAt);

console.log("\n14-day POST + pagination:");
const wide = await scrapeLatestTenders({ fetcher: mockFetcher() });
assert("view switched to 14day", wide.view === "14day", wide.view);
assert("2 pages fetched", wide.pagesFetched === 2, `got ${wide.pagesFetched}`);
assert("4 rows total across 14-day pages", wide.totalRowsParsed === 4, `got ${wide.totalRowsParsed}`);
assert(
  "3 relevant (visa + radar + railway)",
  wide.tenders.length === 3,
  `got ${wide.tenders.length}: ${wide.tenders.map((t) => t.title.slice(0, 18)).join(" | ")}`,
);
assert("radar tagged with 'radar'", wide.tenders.some((t) => t.matchedKeywords.includes("radar")));
assert("rural road not matched", !wide.tenders.some((t) => t.title.includes("rural road")));

console.log("\nfallback when POST fails:");
const fallback = await scrapeLatestTenders({ fetcher: postFailsFetcher() });
assert("falls back to 'today' view", fallback.view === "today", fallback.view);
assert("still parsed the today row", fallback.totalRowsParsed === 1, `got ${fallback.totalRowsParsed}`);

console.log("\nkeyword filter (single page via html option):");
const single = await scrapeLatestTenders({ html: page(WIDE_P1, 1, 2) });
assert("1 relevant on the visa page", single.tenders.length === 1, `got ${single.tenders.length}`);

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
