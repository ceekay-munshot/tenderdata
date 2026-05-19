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

assert("4 announcements parsed", announcements.length === 4);

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

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
