/**
 * Local sanity test for the BSE winner-correlation engine.
 *
 * correlateWinners() matches positive BSE order-win disclosures to award
 * tenders. False positives are costly (they'd drive a real trade), so the
 * test leans on the conservative cases: value contradiction, stale dates
 * and cross-sector noise must NOT produce a winner.
 *
 * Run:  npx tsx scripts/test-correlate-winners.mts
 */

import { correlateWinners } from "../lib/server/correlate-winners.ts";
import type { Tender, Update } from "../lib/types.ts";
import type { BseAnnouncement } from "../lib/scrapers/bse.ts";

type Ann = BseAnnouncement & {
  classification: { tone: "positive" | "negative" | "neutral"; matches: string[] };
};

function award(o: {
  id: string;
  title: string;
  buyer: string;
  value?: number;
  resultDate: string;
}): Tender {
  return {
    id: o.id,
    refNo: o.id,
    title: o.title,
    buyer: o.buyer,
    description: "",
    estimatedValue: o.value,
    bidders: [],
    resultDate: o.resultDate,
    status: "result_in",
    followUps: [],
    publishedAt: "",
    sourcePortal: "BidAssist",
    dataSource: "live",
  };
}

function ann(o: {
  newsId: string;
  ticker: string;
  company: string;
  headline: string;
  filedAt: string;
  tone?: "positive" | "negative" | "neutral";
}): Ann {
  return {
    newsId: o.newsId,
    ticker: o.ticker,
    scripcode: 0,
    companyName: o.company,
    headline: o.headline,
    body: "",
    category: "Award of Order / Receipt of Order",
    filedAt: o.filedAt,
    attachmentUrl: `https://www.bseindia.com/${o.newsId}.pdf`,
    classification: { tone: o.tone ?? "positive", matches: [] },
  };
}

let failed = 0;
function assert(label: string, cond: unknown, detail?: string) {
  if (cond) console.log(`  PASS  ${label}`);
  else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n--- BSE winner-correlation engine local sanity test ---\n");

// --- 1. Confirmed match — company fit + shared keyword + value agree -------
console.log("scenario 1 — strong confirmed match:");
{
  const tender = award({
    id: "T-radar",
    title: "Supply and installation of surveillance radar system for coastal monitoring",
    buyer: "Indian Coast Guard",
    value: 5_000_000_000, // Rs 500 Cr
    resultDate: "2026-05-10",
  });
  const filing = ann({
    newsId: "N1",
    ticker: "BEL",
    company: "BHARAT ELECTRONICS LIMITED",
    headline: "BEL receives Rs.480 Crore order for surveillance radar system",
    filedAt: "2026-05-15",
  });
  const updates: Update[] = [
    { id: "bse-N1", date: "2026-05-15", tenderId: "", kind: "follow_up", ticker: "BEL", text: filing.headline, tone: "positive" },
  ];
  const r = correlateWinners([tender], [filing], updates);
  const t = r.awards[0];
  assert("status flips to awarded", t.status === "awarded", t.status);
  assert("winner name title-cased from CAPS", t.winner === "Bharat Electronics Limited", t.winner);
  assert("won bidder added with ticker", t.bidders[0]?.status === "won" && t.bidders[0]?.ticker === "BEL");
  assert("contract_signed follow-up added", t.followUps[0]?.kind === "contract_signed" && t.followUps[0]?.tone === "positive");
  assert("follow-up cites the BSE filing", (t.followUps[0]?.source ?? "").includes("bseindia.com"));
  assert("confirmed count = 1", r.confirmed === 1, String(r.confirmed));
  assert("BSE update linked to the tender", r.updates[0]?.tenderId === "T-radar", r.updates[0]?.tenderId);
}

// --- 2. Value contradiction is a hard veto --------------------------------
console.log("\nscenario 2 — value contradiction vetoes the match:");
{
  const tender = award({
    id: "T-small",
    title: "Surveillance radar system procurement",
    buyer: "Indian Navy",
    value: 50_000_000, // Rs 5 Cr — far smaller than the Rs 480 Cr filing
    resultDate: "2026-05-10",
  });
  const filing = ann({
    newsId: "N2",
    ticker: "BEL",
    company: "Bharat Electronics Limited",
    headline: "BEL receives Rs.480 Crore order for surveillance radar system",
    filedAt: "2026-05-12",
  });
  const r = correlateWinners([tender], [filing], []);
  assert("no winner — values contradict", r.awards[0].winner === undefined);
  assert("status unchanged", r.awards[0].status === "result_in");
  assert("no follow-up added", r.awards[0].followUps.length === 0);
}

// --- 3. Stale disclosure (outside the time window) ------------------------
console.log("\nscenario 3 — filing outside the 45-day window:");
{
  const tender = award({
    id: "T-rail",
    title: "Railway electrification of the Bhusawal section",
    buyer: "Central Railway",
    resultDate: "2026-01-01",
  });
  const filing = ann({
    newsId: "N3",
    ticker: "RVNL",
    company: "Rail Vikas Nigam Limited",
    headline: "RVNL receives order for railway electrification works",
    filedAt: "2026-05-15", // ~135 days later
  });
  const r = correlateWinners([tender], [filing], []);
  assert("no match — disclosure too old", r.awards[0].winner === undefined && r.awards[0].followUps.length === 0);
}

// --- 4. Cross-sector noise must not match ---------------------------------
console.log("\nscenario 4 — different sector, no match:");
{
  const tender = award({
    id: "T-rail2",
    title: "Railway electrification and overhead equipment works",
    buyer: "Central Railway",
    resultDate: "2026-05-10",
  });
  const filing = ann({
    newsId: "N4",
    ticker: "BEL",
    company: "Bharat Electronics Limited",
    headline: "BEL receives order for surveillance radar system",
    filedAt: "2026-05-12",
  });
  const r = correlateWinners([tender], [filing], []);
  assert("no match — sectors disjoint", r.awards[0].winner === undefined && r.awards[0].followUps.length === 0);
}

// --- 5. Weak match surfaces as an unconfirmed "possible" lead -------------
console.log("\nscenario 5 — weak match becomes a 'possible' lead, not a winner:");
{
  const tender = award({
    id: "T-xpr",
    title: "Construction of expressway package 4",
    buyer: "NHAI",
    resultDate: "2026-05-10",
  });
  // RVNL is not a heavy-EPC sector ticker — company fit fails, value unknown.
  const filing = ann({
    newsId: "N5",
    ticker: "RVNL",
    company: "Rail Vikas Nigam Limited",
    headline: "RVNL bags expressway construction order",
    filedAt: "2026-05-12",
  });
  const r = correlateWinners([tender], [filing], []);
  assert("not awarded — match too weak to confirm", r.awards[0].status === "result_in");
  assert("no winner asserted", r.awards[0].winner === undefined);
  assert("possible-lead follow-up added", r.awards[0].followUps[0]?.kind === "news" && r.awards[0].followUps[0]?.tone === "neutral");
  assert("lead text flags it as unconfirmed", (r.awards[0].followUps[0]?.text ?? "").includes("Possible winner"));
  assert("possible count = 1", r.possible === 1, String(r.possible));
}

// --- 6. One filing cannot confirm two tenders -----------------------------
console.log("\nscenario 6 — one filing confirms only its best-scoring tender:");
{
  const tenderA = award({
    id: "T-a",
    title: "Surveillance radar system upgrade programme",
    buyer: "Indian Air Force",
    value: 4_800_000_000, // agrees with the filing -> higher score
    resultDate: "2026-05-10",
  });
  const tenderB = award({
    id: "T-b",
    title: "Surveillance radar system installation works",
    buyer: "Indian Navy",
    resultDate: "2026-05-10",
  });
  const filing = ann({
    newsId: "N6",
    ticker: "BEL",
    company: "Bharat Electronics Limited",
    headline: "BEL receives Rs.480 Crore order for surveillance radar system",
    filedAt: "2026-05-12",
  });
  const r = correlateWinners([tenderA, tenderB], [filing], []);
  const a = r.awards.find((t) => t.id === "T-a")!;
  const b = r.awards.find((t) => t.id === "T-b")!;
  assert("best tender (value agrees) is confirmed", a.status === "awarded" && a.winner !== undefined);
  assert("the other tender is not also confirmed", b.status !== "awarded" && b.winner === undefined);
  assert("the other tender keeps a possible lead", b.followUps[0]?.kind === "news");
  assert("exactly 1 confirmed, 1 possible", r.confirmed === 1 && r.possible === 1, `${r.confirmed}/${r.possible}`);
}

// --- 7. Empty BSE feed is a no-op -----------------------------------------
console.log("\nscenario 7 — empty BSE feed leaves awards untouched:");
{
  const tender = award({ id: "T-x", title: "Surveillance radar system", buyer: "Indian Navy", resultDate: "2026-05-10" });
  const r = correlateWinners([tender], [], []);
  assert("awards returned unchanged", r.awards[0] === tender && r.confirmed === 0 && r.possible === 0);
}

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`}\n`);
process.exit(failed === 0 ? 0 : 1);
