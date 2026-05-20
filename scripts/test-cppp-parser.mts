/**
 * Local sanity test for the CPPP scraper.
 *
 * eprocure.gov.in is unreachable from the dev sandbox, so we feed
 * scrapeLatestTenders a known CPPP-shaped HTML page (via the `html`
 * option) and assert the parser + keyword filter behave.
 *
 * Run:  npx tsx scripts/test-cppp-parser.mts
 */

import { scrapeLatestTenders, parseCpppDate, parseTenderTable } from "../lib/scrapers/cppp.ts";

// ---------------------------------------------------------------------------
// Mock CPPP "Latest Active Tenders" page — mirrors the real table layout:
// S.No | e-Published Date | Bid Submission Closing Date | Tender Opening Date
//      | Title and Ref.No./Tender ID | Organisation Chain
// ---------------------------------------------------------------------------
const MOCK_CPPP_HTML = `
<html><body>
<table id="header"><tr><td>logo</td></tr></table>
<table id="table" class="list_table">
  <tr>
    <th>S.No</th>
    <th>e-Published Date</th>
    <th>Bid Submission Closing Date</th>
    <th>Tender Opening Date</th>
    <th>Title and Ref.No./Tender ID</th>
    <th>Organisation Chain</th>
  </tr>
  <tr>
    <td>1</td>
    <td>15-May-2026 05:00 PM</td>
    <td>05-Jun-2026 03:00 PM</td>
    <td>06-Jun-2026 03:30 PM</td>
    <td><a href="/eprocure/app?component=view&amp;id=111">Provision of Visa and Passport outsourcing services at Embassy of India</a> [2026_MEA_812345_1]</td>
    <td>Ministry of External Affairs||Consular Passport and Visa Division</td>
  </tr>
  <tr>
    <td>2</td>
    <td>14-May-2026 11:00 AM</td>
    <td>10-Jun-2026 02:00 PM</td>
    <td>11-Jun-2026 11:00 AM</td>
    <td><a href="/eprocure/app?component=view&amp;id=222">Supply of Light Mountain Radar systems for Air Defence</a> [2026_MOD_777001_2]</td>
    <td>Ministry of Defence||Indian Air Force</td>
  </tr>
  <tr>
    <td>3</td>
    <td>13-May-2026 09:30 AM</td>
    <td>02-Jun-2026 05:00 PM</td>
    <td>03-Jun-2026 11:00 AM</td>
    <td><a href="/eprocure/app?component=view&amp;id=333">Construction of rural road and culverts in Rewa district</a> [2026_PWD_440022_1]</td>
    <td>Madhya Pradesh PWD||Rewa Division</td>
  </tr>
  <tr>
    <td>4</td>
    <td>12-May-2026 04:00 PM</td>
    <td>20-Jun-2026 03:00 PM</td>
    <td>21-Jun-2026 11:30 AM</td>
    <td><a href="/eprocure/app?component=view&amp;id=444">Railway electrification and overhead equipment works, Bhusawal section</a> [2026_RAIL_990011_3]</td>
    <td>Ministry of Railways||Central Railway</td>
  </tr>
  <tr>
    <td>5</td>
    <td>11-May-2026 10:00 AM</td>
    <td>01-Jun-2026 05:00 PM</td>
    <td>02-Jun-2026 11:00 AM</td>
    <td><a href="/eprocure/app?component=view&amp;id=555">Catering services for staff canteen, monthly contract</a> [2026_GEN_120033_1]</td>
    <td>Some State Department||Admin Wing</td>
  </tr>
</table>
</body></html>
`;

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
  "'19-May-2026 03:00 PM' -> 15:00 IST",
  parseCpppDate("19-May-2026 03:00 PM") === "2026-05-19T09:30:00.000Z",
  parseCpppDate("19-May-2026 03:00 PM") ?? "null",
);
assert(
  "'06-Jun-2026 11:30 AM' parses",
  parseCpppDate("06-Jun-2026 11:30 AM") === "2026-06-06T06:00:00.000Z",
  parseCpppDate("06-Jun-2026 11:30 AM") ?? "null",
);
assert("date-only '19-May-2026' parses", parseCpppDate("19-May-2026") !== null);
assert("garbage returns null", parseCpppDate("not a date") === null);
assert("empty returns null", parseCpppDate("") === null);

// --- raw table parsing ----------------------------------------------------
console.log("\ntable parsing:");
const rawRows = parseTenderTable(MOCK_CPPP_HTML);
assert("5 tender rows parsed (header skipped)", rawRows.length === 5, `got ${rawRows.length}`);

const visa = rawRows.find((r) => r.title.includes("Visa and Passport"));
assert("visa tender parsed", !!visa);
assert("tender ref extracted", visa?.tenderRef === "2026_MEA_812345_1", visa?.tenderRef);
assert(
  "buyer = first org segment",
  visa?.buyer === "Ministry of External Affairs",
  visa?.buyer,
);
assert("detail URL absolutised", visa?.detailUrl?.startsWith("https://eprocure.gov.in") ?? false);
assert("bid closing date parsed", !!visa?.bidSubmissionCloses);
assert("tender opening date parsed", !!visa?.tenderOpensAt);

// --- keyword filtering ----------------------------------------------------
console.log("\nkeyword filter:");
const { tenders, totalRowsParsed } = await scrapeLatestTenders({ html: MOCK_CPPP_HTML });
assert("totalRowsParsed = 5", totalRowsParsed === 5, `got ${totalRowsParsed}`);
assert("3 relevant tenders after filter", tenders.length === 3, `got ${tenders.length}`);

const relevantTitles = tenders.map((t) => t.title);
assert(
  "visa tender kept",
  relevantTitles.some((t) => t.includes("Visa and Passport")),
);
assert(
  "radar tender kept",
  relevantTitles.some((t) => t.includes("Radar")),
);
assert(
  "railway electrification tender kept",
  relevantTitles.some((t) => t.includes("Railway electrification")),
);
assert(
  "rural road tender dropped (no sector match)",
  !relevantTitles.some((t) => t.includes("rural road")),
);
assert(
  "catering tender dropped (no sector match)",
  !relevantTitles.some((t) => t.includes("Catering")),
);

const radar = tenders.find((t) => t.title.includes("Radar"));
assert(
  "radar tender tagged with 'radar' keyword",
  radar?.matchedKeywords.includes("radar") ?? false,
  radar?.matchedKeywords.join(","),
);

// --- empty / broken page --------------------------------------------------
console.log("\nbroken page handling:");
const broken = await scrapeLatestTenders({ html: "<html><body>error</body></html>" });
assert("0 rows on broken page", broken.totalRowsParsed === 0);
assert("rawHtml is returned for debugging", typeof broken.rawHtml === "string" && broken.rawHtml.length > 0);

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
