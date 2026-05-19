/**
 * Local sanity test for the BSE scraper.
 *
 * Sandbox can't reach bseindia.com (outbound allowlist), but we don't need
 * to — the scraper accepts an injected `fetcher`, so we feed it a known
 * BSE-shaped JSON response and assert the parser/classifier behaves.
 *
 * Run:  npx tsx scripts/test-bse-parser.mts
 */

import {
  fetchBseAnnouncements,
  classifyAnnouncement,
  announcementToUpdate,
} from "../lib/scrapers/bse.ts";

// ---------------------------------------------------------------------------
// Mock BSE response — shapes lifted from real api.bseindia.com replies.
// ---------------------------------------------------------------------------
const MOCK_BSE_RESPONSE = {
  Table: [
    {
      NEWSID: "1234567",
      SCRIP_CD: 540073,
      SLONGNAME: "BLS INTERNATIONAL SERVICES LTD.",
      HEADLINE: "Debarment Order - Ministry of External Affairs",
      NEWSSUB: "Disclosure under Regulation 30",
      MORE: "BLS International debarred from all MEA tenders for 2 years citing breach of UAE contract obligations.",
      CATEGORYNAME: "Regulatory Action",
      NEWS_DT: "2026-05-15T18:42:00",
      ATTACHMENTNAME: "abc123.pdf",
    },
    {
      NEWSID: "1234568",
      SCRIP_CD: 540073,
      SLONGNAME: "BLS INTERNATIONAL SERVICES LTD.",
      HEADLINE: "Loss of UAE Visa Outsourcing Contract",
      NEWSSUB: "Disclosure under Reg 30",
      MORE: "We wish to inform that we are not the L1 bidder. The contract has been awarded to Alhind Group.",
      CATEGORYNAME: "Contract Update",
      NEWS_DT: "2026-05-08T17:12:00",
      ATTACHMENTNAME: "def456.pdf",
    },
    {
      NEWSID: "1234569",
      SCRIP_CD: 540073,
      HEADLINE: "Resignation of Statutory Auditor",
      MORE: "M/s Walker Chandiok & Co. LLP has tendered their resignation as statutory auditors.",
      CATEGORYNAME: "Governance",
      NEWS_DT: "2026-05-18T19:48:00",
    },
    {
      NEWSID: "9999111",
      SCRIP_CD: 540073,
      HEADLINE: "Letter of Award (LOA) received — Morocco visa contract",
      MORE: "BLS International has been awarded the Embassy of India, Rabat visa contract worth INR 84.5 Cr.",
      CATEGORYNAME: "Contract Win",
      NEWS_DT: "2026-05-19T11:30:00",
    },
    // Real-world headlines from the first GHA scrape that the classifier
    // initially missed. Locked in here so future regex tweaks don't
    // silently regress them.
    {
      NEWSID: "real-001",
      SCRIP_CD: 500049,
      HEADLINE: "BEL receives Rs.1251 Crore order for supply of Ground Based Mobile ELINT System (GBMES) to Indian Army.",
      MORE: "",
      CATEGORYNAME: "Company Update",
      NEWS_DT: "2026-05-12T10:00:00",
    },
    {
      NEWSID: "real-002",
      SCRIP_CD: 500049,
      HEADLINE: "BEL receives orders worth Rs. 569 Crore.",
      MORE: "",
      CATEGORYNAME: "Company Update",
      NEWS_DT: "2026-05-09T10:00:00",
    },
    {
      NEWSID: "real-003",
      SCRIP_CD: 500510,
      HEADLINE: "L&T Wins Orders (Significant*) for Power Transmission & Distribution Business",
      MORE: "",
      CATEGORYNAME: "Company Update",
      NEWS_DT: "2026-05-14T10:00:00",
    },
    {
      NEWSID: "real-004",
      SCRIP_CD: 500510,
      HEADLINE: "L&T Secures (Large*) Order to Reinforce India's Energy Security Through Coal Gasification",
      MORE: "",
      CATEGORYNAME: "Company Update",
      NEWS_DT: "2026-05-11T10:00:00",
    },
    {
      NEWSID: "real-005",
      SCRIP_CD: 500510,
      HEADLINE: "L&T Strengthens its Coal-to-Chemicals EPC Leadership with Significant* Order from BCGCL",
      MORE: "",
      CATEGORYNAME: "Company Update",
      NEWS_DT: "2026-05-10T10:00:00",
    },
    {
      NEWSID: "real-006",
      SCRIP_CD: 540073,
      HEADLINE: "Outcome of the meeting of Nomination and Remuneration Committee held on Tuesday, May 19, 2026",
      MORE: "",
      CATEGORYNAME: "Board Meeting",
      NEWS_DT: "2026-05-19T15:00:00",
    },
  ],
};

function makeMockFetcher() {
  return async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    if (!url.includes("api.bseindia.com")) {
      throw new Error(`Mock fetcher only handles BSE, got: ${url}`);
    }
    return new Response(JSON.stringify(MOCK_BSE_RESPONSE), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  };
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
let failed = 0;
function assert(label: string, cond: unknown, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n--- BSE scraper local sanity test ---\n");

const announcements = await fetchBseAnnouncements("BLS", {
  fetcher: makeMockFetcher() as typeof fetch,
});

console.log(`Pulled ${announcements.length} announcements\n`);
for (const a of announcements) {
  const cls = classifyAnnouncement(a);
  const upd = announcementToUpdate(a);
  console.log(`  [${cls.tone.padEnd(8)}] ${a.headline}`);
  console.log(`             triggers=[${cls.matches.join(", ") || "—"}]`);
  console.log(`             filedAt=${a.filedAt}  attach=${a.attachmentUrl ? "yes" : "no"}`);
  console.log(`             update.text=${upd.text.slice(0, 60)}…`);
  console.log("");
}

console.log("--- assertions ---");

assert("all announcements parsed", announcements.length === 10);

const debar = announcements.find((a) => a.headline.includes("Debarment"));
assert("debarment is parsed", !!debar);
assert(
  "debarment classified as negative",
  debar && classifyAnnouncement(debar).tone === "negative",
);

const lossDisc = announcements.find((a) => a.headline.includes("Loss of UAE"));
assert("loss-of-contract is parsed", !!lossDisc);
assert(
  "loss-of-contract classified as negative",
  lossDisc && classifyAnnouncement(lossDisc).tone === "negative",
);

const loa = announcements.find((a) => a.headline.includes("LOA"));
assert("LOA win parsed", !!loa);
assert(
  "LOA classified as positive",
  loa && classifyAnnouncement(loa).tone === "positive",
);

const auditor = announcements.find((a) => a.headline.includes("Auditor"));
assert("auditor resignation parsed", !!auditor);

assert(
  "ISO dates parsed correctly",
  announcements.every((a) => !isNaN(new Date(a.filedAt).getTime())),
);

assert(
  "attachment URLs built when present",
  debar?.attachmentUrl?.includes("xml-data/corpfiling/AttachLive") ?? false,
);

assert(
  "missing attachment leaves URL undefined",
  auditor?.attachmentUrl === undefined,
);

const update = announcementToUpdate(announcements[0]);
assert("update id has bse- prefix", update.id.startsWith("bse-"));
assert("update carries ticker", update.ticker === "BLS");

// Real-world classification regressions caught from the first GHA scrape.
const belOrderHeadline = "BEL receives Rs.1251 Crore order";
const belOrder = announcements.find((a) => a.headline.startsWith(belOrderHeadline));
assert(
  "BEL 'receives Rs.X Crore order' classified as positive",
  belOrder && classifyAnnouncement(belOrder).tone === "positive",
);

const belMany = announcements.find((a) => a.headline.includes("receives orders worth"));
assert(
  "BEL 'receives orders worth' classified as positive",
  belMany && classifyAnnouncement(belMany).tone === "positive",
);

const ltWins = announcements.find((a) => a.headline.startsWith("L&T Wins Orders"));
assert(
  "L&T 'Wins Orders (Significant*)' classified as positive",
  ltWins && classifyAnnouncement(ltWins).tone === "positive",
);

const ltSecures = announcements.find((a) => a.headline.startsWith("L&T Secures"));
assert(
  "L&T 'Secures (Large*) Order' classified as positive",
  ltSecures && classifyAnnouncement(ltSecures).tone === "positive",
);

const ltStrengthens = announcements.find((a) => a.headline.startsWith("L&T Strengthens"));
assert(
  "L&T 'Strengthens ... with Significant* Order from' classified as positive",
  ltStrengthens && classifyAnnouncement(ltStrengthens).tone === "positive",
);

const nrcMeeting = announcements.find((a) => a.headline.startsWith("Outcome of the meeting"));
assert(
  "routine committee meeting stays neutral",
  nrcMeeting && classifyAnnouncement(nrcMeeting).tone === "neutral",
);

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
