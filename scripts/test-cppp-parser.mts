/**
 * Local sanity test for the CPPP scraper.
 *
 * Mirrors the real eprocure.gov.in "Tenders by Closing Date" markup
 * captured from a live run: <tr id="informal"> rows, title inside an <a>,
 * canonical tender IDs, and GET-based pagination links.
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

/** Build one CPPP tender <tr id="informal..."> exactly as the real page does. */
function row(r: Row, idx: number): string {
  const id = idx === 0 ? "informal" : `informal_${idx}`;
  return `
  <tr class="${idx % 2 ? "odd" : "even"}" id="${id}">
    <td align="center">${r.sno}</td>
    <td align="center">${r.published}</td>
    <td align="center">${r.closing}</td>
    <td align="center">${r.opening}</td>
    <td align="center"><a id="DirectLink_${idx}" title="View Tender Information" href="/eprocure/app?component=%24DirectLink&amp;page=FrontEndListTendersbyDate&amp;service=direct&amp;session=T&amp;sp=Stoken${idx}">[${r.title}]</a>
      [${r.deptRef}][${r.tenderId}]
    </td>
    <td align="center">${r.org}</td>
  </tr>`;
}

/** Build a full CPPP listing page with the given rows + pagination footer. */
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
    <table id="table" class="list_table">
      <tr class="list_header">
        <td>S.No</td><td>e-Published Date</td><td>Bid Submission Closing Date</td>
        <td>Tender Opening Date</td><td>Title and Ref.No./Tender ID</td><td>Organisation Chain</td>
      </tr>
      ${rows.map(row).join("\n")}
      <tr><td class="list_footer" colspan="8">${pager}</td></tr>
    </table>
    <tr class="footer"><td>Designed, Developed and Hosted by National Informatics Centre</td></tr>
  </body></html>`;
}

const PAGE1: Row[] = [
  {
    sno: "1.", published: "12-May-2026 09:00 AM", closing: "20-May-2026 09:00 AM",
    opening: "21-May-2026 11:00 AM",
    title: "Comprehensive Annual Maintenance Contract",
    deptRef: "CAMC/ELWB/FSDDhemaji/2026", tenderId: "2026_FCI_908269_1",
    org: "Food Corporation of India||Regional Office,Assam,FCI",
  },
  {
    sno: "2.", published: "07-May-2026 12:10 PM", closing: "20-May-2026 05:00 PM",
    opening: "26-May-2026 11:30 AM",
    title: "Provision of Visa and Passport outsourcing services at Embassy of India",
    deptRef: "MEA/CONSULAR/2026/MOR", tenderId: "2026_MEA_812345_1",
    org: "Ministry of External Affairs||Consular Passport and Visa Division",
  },
];

const PAGE2: Row[] = [
  {
    sno: "3.", published: "10-May-2026 10:00 AM", closing: "21-May-2026 03:00 PM",
    opening: "09-Jun-2026 11:30 AM",
    title: "Supply of Light Mountain Radar systems for Air Defence",
    deptRef: "MOD/IAF/RADAR/2026", tenderId: "2026_MOD_777001_2",
    org: "Ministry of Defence||Indian Air Force",
  },
  {
    sno: "4.", published: "09-May-2026 02:00 PM", closing: "22-May-2026 04:00 PM",
    opening: "23-May-2026 11:00 AM",
    title: "Construction of rural road and culverts in Rewa district",
    deptRef: "PWD/RWA/2026", tenderId: "2026_PWD_440022_1",
    org: "Madhya Pradesh PWD||Rewa Division",
  },
];

const PAGE3: Row[] = [
  {
    sno: "5.", published: "08-May-2026 11:00 AM", closing: "25-May-2026 05:00 PM",
    opening: "22-Jun-2026 11:30 AM",
    title: "Railway electrification and overhead equipment works, Bhusawal section",
    deptRef: "RAIL/CR/2026", tenderId: "2026_RAIL_990011_3",
    org: "Ministry of Railways||Central Railway",
  },
];

function mockFetcher(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    let html: string;
    if (/sp=3\b/.test(url)) html = page(PAGE3, 3, 3);
    else if (/sp=2\b/.test(url)) html = page(PAGE2, 2, 3);
    else html = page(PAGE1, 1, 3);
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

console.log("\n--- CPPP scraper local sanity test ---\n");

// --- date parsing ---------------------------------------------------------
console.log("date parsing:");
assert(
  "'19-May-2026 03:00 PM' -> 09:30 UTC",
  parseCpppDate("19-May-2026 03:00 PM") === "2026-05-19T09:30:00.000Z",
  parseCpppDate("19-May-2026 03:00 PM") ?? "null",
);
assert("date-only parses", parseCpppDate("19-May-2026") !== null);
assert("garbage returns null", parseCpppDate("not a date") === null);

// --- single-page row parsing ---------------------------------------------
console.log("\nrow parsing:");
const rawRows = parseTenderTable(page(PAGE1, 1, 3));
assert("2 informal rows parsed (header/footer skipped)", rawRows.length === 2, `got ${rawRows.length}`);

const fci = rawRows.find((r) => r.tenderRef === "2026_FCI_908269_1");
assert("canonical tender ref extracted", !!fci, "FCI row not found");
assert(
  "title taken from <a>, brackets stripped",
  fci?.title === "Comprehensive Annual Maintenance Contract",
  fci?.title,
);
assert("buyer = first org segment", fci?.buyer === "Food Corporation of India", fci?.buyer);
assert(
  "detail URL absolutised + &amp; decoded",
  (fci?.detailUrl?.startsWith("https://eprocure.gov.in/eprocure/app?component=") &&
    !fci.detailUrl.includes("&amp;")) ?? false,
  fci?.detailUrl,
);
assert("published date parsed", !!fci?.publishedAt);
assert("bid closing date parsed", !!fci?.bidSubmissionCloses);
assert("tender opening date parsed", !!fci?.tenderOpensAt);

// --- keyword filter (single page) ----------------------------------------
console.log("\nkeyword filter:");
const single = await scrapeLatestTenders({ html: page(PAGE1, 1, 3) });
assert("totalRowsParsed = 2", single.totalRowsParsed === 2);
assert("1 relevant (visa) after filter", single.tenders.length === 1, `got ${single.tenders.length}`);
assert(
  "visa tender matched",
  single.tenders[0]?.title.includes("Visa and Passport"),
  single.tenders[0]?.title,
);

// --- pagination -----------------------------------------------------------
console.log("\npagination (3 pages via mock fetcher):");
const paged = await scrapeLatestTenders({ fetcher: mockFetcher() });
assert("3 pages fetched", paged.pagesFetched === 3, `got ${paged.pagesFetched}`);
assert("5 rows total across pages", paged.totalRowsParsed === 5, `got ${paged.totalRowsParsed}`);
assert(
  "3 relevant (visa + radar + railway)",
  paged.tenders.length === 3,
  `got ${paged.tenders.length}: ${paged.tenders.map((t) => t.title.slice(0, 20)).join(" | ")}`,
);
assert(
  "radar tender tagged with 'radar'",
  paged.tenders.some((t) => t.matchedKeywords.includes("radar")),
);
assert(
  "rural road dropped (no sector match)",
  !paged.allRows.some((t) => t.title.includes("rural road") && t.matchedKeywords.length > 0),
);

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
