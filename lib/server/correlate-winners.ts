/**
 * Winner detection by correlating BSE disclosures with award tenders.
 *
 * BidAssist's results listing tells us a tender reached a decision stage
 * but never names the winner (that's in the paywalled AOC document). BSE
 * does: when a listed company wins a government contract it must disclose
 * it ("X receives Rs.N Crore order ..."). The BSE scraper already pulls
 * and tone-classifies those filings.
 *
 * This module bridges the two. For each award tender it looks for a
 * positive BSE filing that plausibly describes the same contract, using
 * only curated/structured signals — no shared key exists between the two
 * sources, so matching is deliberately conservative:
 *
 *   - sector overlap   — both map to the same SECTORS bucket (gate)
 *   - time window      — filed within MATCH_WINDOW_DAYS of the result
 *   - value            — Rs-figure in the filing agrees with the tender
 *                        estimate; a clear contradiction is a hard veto
 *   - company fit      — the filer operates in the tender's sector
 *   - shared keywords  — both hit the same specific keyword phrase
 *
 * A match is "confirmed" only with strong corroboration; weaker matches
 * are surfaced as "possible" leads that do NOT assert a winner. Every
 * match carries the BSE headline + filing link as evidence so the call
 * can be sanity-checked before taking a position.
 *
 * Pure + synchronous — runs server-side in the page from already-loaded
 * data. If the BSE feed is empty it returns its inputs untouched.
 */

import type { Tender, Bidder, FollowUp, Update } from "../types";
import type { BsePayload } from "./load-updates";
import { matchTenderKeywords, type KeywordMatch } from "../scrapers/sector-keywords";

type Announcement = BsePayload["announcements"][number];

/** A BSE win is relevant only if filed within this many days of the result. */
const MATCH_WINDOW_DAYS = 45;
/** min(a,b)/max(a,b) at or above this counts as the same contract value. */
const VALUE_AGREE_RATIO = 0.6;

/** Generic words stripped before testing a buyer name against filing text. */
const GENERIC_BUYER_WORDS = new Set([
  "department", "ministry", "office", "public", "works", "government",
  "india", "indian", "central", "state", "limited", "corporation", "board",
  "authority", "commission", "division", "national", "regional", "district",
  "council", "general", "directorate", "zone", "circle", "project",
]);

export interface CorrelationResult {
  /** Award tenders, enriched with a winner / possible-lead follow-up. */
  awards: Tender[];
  /** BSE updates, with tenderId filled in for the ones that linked. */
  updates: Update[];
  /** Count of tenders given a confirmed winner. */
  confirmed: number;
  /** Count of tenders given an unconfirmed "possible winner" lead. */
  possible: number;
}

export function correlateWinners(
  awards: Tender[],
  announcements: Announcement[],
  bseUpdates: Update[],
): CorrelationResult {
  const wins = announcements.filter((a) => a.classification?.tone === "positive");
  if (awards.length === 0 || wins.length === 0) {
    return { awards, updates: bseUpdates, confirmed: 0, possible: 0 };
  }

  const awardKw = awards.map((t) => matchTenderKeywords(t.title, t.buyer));
  const annKw = wins.map((a) => matchTenderKeywords(a.headline, a.body));
  const annValue = wins.map((a) => extractValueINR(`${a.headline}  ${a.body}`));

  // All passing (tender, announcement) pairs, strongest first.
  interface Candidate { ti: number; ai: number; tier: "confirmed" | "possible"; score: number }
  const candidates: Candidate[] = [];
  awards.forEach((t, ti) => {
    wins.forEach((a, ai) => {
      const verdict = evaluatePair(t, awardKw[ti], a, annKw[ai], annValue[ai]);
      if (verdict) candidates.push({ ti, ai, ...verdict });
    });
  });
  candidates.sort((x, y) => y.score - x.score);

  // Greedy assignment: each filing confirms at most one tender, each
  // tender is confirmed at most once. Strongest pairs win.
  const decided = new Set<number>();
  const usedAnn = new Set<number>();
  const outcome = new Map<number, { ai: number; tier: "confirmed" | "possible" }>();

  for (const c of candidates) {
    if (c.tier !== "confirmed" || decided.has(c.ti) || usedAnn.has(c.ai)) continue;
    decided.add(c.ti);
    usedAnn.add(c.ai);
    outcome.set(c.ti, { ai: c.ai, tier: "confirmed" });
  }
  // Any tender left over keeps its best remaining pair as a "possible"
  // lead — a filing already used to confirm elsewhere can still hint here.
  for (const c of candidates) {
    if (decided.has(c.ti)) continue;
    decided.add(c.ti);
    outcome.set(c.ti, { ai: c.ai, tier: "possible" });
  }

  const linked = new Map<string, string>(); // newsId -> tenderId
  let confirmed = 0;
  let possible = 0;

  const enrichedAwards = awards.map((t, ti) => {
    const o = outcome.get(ti);
    if (!o) return t;
    const a = wins[o.ai];
    linked.set(a.newsId, t.id);
    if (o.tier === "confirmed") {
      confirmed++;
      return applyConfirmed(t, a);
    }
    possible++;
    return applyPossible(t, a);
  });

  const enrichedUpdates = bseUpdates.map((u) => {
    const newsId = u.id.startsWith("bse-") ? u.id.slice(4) : null;
    const tenderId = newsId ? linked.get(newsId) : undefined;
    return tenderId && !u.tenderId ? { ...u, tenderId } : u;
  });

  return { awards: enrichedAwards, updates: enrichedUpdates, confirmed, possible };
}

// ---------------------------------------------------------------------------
// pair scoring
// ---------------------------------------------------------------------------

function evaluatePair(
  tender: Tender,
  tk: KeywordMatch,
  ann: Announcement,
  ak: KeywordMatch,
  annValue: number | null,
): { tier: "confirmed" | "possible"; score: number } | null {
  // Gate 1 — same sector.
  const sharedSectors = tk.sectorIds.filter((s) => ak.sectorIds.includes(s));
  if (sharedSectors.length === 0) return null;

  // Gate 2 — filed near the result date.
  const daysApart =
    Math.abs(new Date(ann.filedAt).getTime() - new Date(tender.resultDate).getTime()) /
    86_400_000;
  if (!Number.isFinite(daysApart) || daysApart > MATCH_WINDOW_DAYS) return null;

  // Gate 3 — values must not contradict.
  let valueState: "agree" | "contradict" | "unknown" = "unknown";
  if (tender.estimatedValue && tender.estimatedValue > 0 && annValue && annValue > 0) {
    const ratio =
      Math.min(tender.estimatedValue, annValue) / Math.max(tender.estimatedValue, annValue);
    valueState = ratio >= VALUE_AGREE_RATIO ? "agree" : "contradict";
  }
  if (valueState === "contradict") return null;

  const sharedKeywords = tk.matchedKeywords.filter((k) => ak.matchedKeywords.includes(k));
  const companyFit = tk.tickers.includes(ann.ticker);
  const buyerOk = buyerHit(tender.buyer, `${ann.headline}  ${ann.body}`);

  // Confirmed needs the filer to fit the sector AND a specific corroborator,
  // or two independent specific corroborators.
  const confirmed =
    (companyFit && (sharedKeywords.length >= 1 || valueState === "agree")) ||
    sharedKeywords.length >= 2 ||
    (sharedKeywords.length >= 1 && valueState === "agree");

  // Too weak for even a "possible" lead — sector + timing alone is noise.
  if (!confirmed && !companyFit && sharedKeywords.length === 0) return null;

  const score =
    sharedKeywords.length * 3 +
    sharedSectors.length +
    (companyFit ? 2 : 0) +
    (valueState === "agree" ? 3 : 0) +
    (buyerOk ? 1.5 : 0) +
    (1 - daysApart / MATCH_WINDOW_DAYS);

  return { tier: confirmed ? "confirmed" : "possible", score };
}

/** Largest "Rs.N Crore / Lakh" figure in the text, in INR. null if none. */
function extractValueINR(text: string): number | null {
  const re = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)\s*(crore|cr|lakhs?|lac)\b/gi;
  let max: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(num)) continue;
    const inr = /^cr/i.test(m[2]) ? num * 1e7 : num * 1e5;
    if (max === null || inr > max) max = inr;
  }
  return max;
}

/** True if a distinctive word of the buyer name appears in the filing text. */
function buyerHit(buyer: string, text: string): boolean {
  const haystack = text.toLowerCase();
  const tokens = (buyer.toLowerCase().match(/[a-z]+/g) ?? []).filter(
    (w) => w.length >= 4 && !GENERIC_BUYER_WORDS.has(w),
  );
  return tokens.some((w) => haystack.includes(w));
}

// ---------------------------------------------------------------------------
// applying a match to a tender
// ---------------------------------------------------------------------------

function applyConfirmed(tender: Tender, ann: Announcement): Tender {
  const name = tidyCompany(ann.companyName) || ann.ticker;
  const winner: Bidder = { name, ticker: ann.ticker, status: "won" };
  const followUp: FollowUp = {
    id: `bse-win-${ann.newsId}`,
    date: ann.filedAt,
    kind: "contract_signed",
    ticker: ann.ticker,
    text: `${name} disclosed this win to BSE: "${ann.headline}"`,
    tone: "positive",
    source: ann.attachmentUrl ?? "BSE corporate filing",
  };
  return {
    ...tender,
    status: "awarded",
    winner: name,
    bidders: [winner, ...tender.bidders],
    followUps: [followUp, ...tender.followUps],
  };
}

function applyPossible(tender: Tender, ann: Announcement): Tender {
  const name = tidyCompany(ann.companyName) || ann.ticker;
  const followUp: FollowUp = {
    id: `bse-maybe-${ann.newsId}`,
    date: ann.filedAt,
    kind: "news",
    ticker: ann.ticker,
    text:
      `Possible winner — ${name} disclosed an order win to BSE that may relate ` +
      `to this tender: "${ann.headline}". Unconfirmed: buyer/value not matched.`,
    tone: "neutral",
    source: ann.attachmentUrl ?? "BSE corporate filing",
  };
  return { ...tender, followUps: [followUp, ...tender.followUps] };
}

/** BSE long names arrive ALL CAPS — title-case them when so. */
function tidyCompany(name: string): string {
  const n = name.trim();
  if (!n) return "";
  const letters = n.replace(/[^a-zA-Z]/g, "");
  const uppers = n.replace(/[^A-Z]/g, "").length;
  if (letters.length > 0 && uppers / letters.length > 0.7) {
    return n.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return n;
}
