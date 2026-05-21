/**
 * Runtime loader for scraped BidAssist bid-awards (tender results).
 *
 * The GHA scraper commits data/bidassist-awards.json to the `data`
 * branch; the app fetches the raw URL at request time with ISR caching
 * and adapts each award into the dashboard's Tender shape with
 * status "result_in" — a tender whose result is in / imminent.
 *
 * The public listing does not name the winning bidder (that lives in the
 * paywalled AOC document), so `winner` and `bidders` are left empty.
 */

import type { Tender } from "@/lib/types";

const OWNER = process.env.NEXT_PUBLIC_REPO_OWNER ?? "ceekay-munshot";
const REPO = process.env.NEXT_PUBLIC_REPO_NAME ?? "tenderdata";
const BRANCH = process.env.NEXT_PUBLIC_DATA_BRANCH ?? "data";

const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/data/bidassist-awards.json`;

const STALE_AFTER_MS = 8 * 60 * 60 * 1000; // 8h
const REVALIDATE_SECONDS = 120;
/** Result dates beyond this horizon are estimates — fall back to postedAt. */
const FUTURE_DATE_CAP_MS = 400 * 24 * 60 * 60 * 1000; // ~13 months

interface BidAssistAwardRaw {
  awardId: string;
  tenderId: string;
  refNo: string;
  title: string;
  buyer: string;
  procurementSource?: string;
  typeOfContract?: string;
  state?: string;
  value?: number;
  awardStage?: string;
  resultStage?: string;
  resultDate: string | null;
  postedAt: string | null;
  contractDate: string | null;
  aocAvailable: boolean;
  sectorNames: string[];
  detailUrl?: string;
  matchedKeywords: string[];
}

interface BidAssistAwardsPayload {
  fetchedAt: string;
  ok: boolean;
  error?: string;
  source: string;
  sortMode: string;
  pagesFetched: number;
  totalAvailable: number | null;
  totalScanned: number;
  relevantCount: number;
  awards: BidAssistAwardRaw[];
}

export interface BidAssistAwardsLoadResult {
  /** Watchlist-matched awards, adapted to the dashboard Tender shape. */
  tenders: Tender[];
  fetchedAt: string | null;
  /** Total awards scanned this run (matched + unmatched). */
  scanned: number;
  stale: boolean;
  status: "ok" | "empty" | "missing" | "error";
  error?: string;
}

/** "FINANCIAL_BID_OPENING_DATE" -> "Financial bid opening". */
function prettyStage(stage?: string): string | null {
  if (!stage) return null;
  const words = stage
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\bdate\b/g, "")
    .trim();
  if (!words) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Pick a sane headline date. bidAwardStageDate is sometimes a far-future
 * contract estimate, so anything past the horizon falls back to postedAt.
 */
function pickResultDate(a: BidAssistAwardRaw): string {
  const cap = Date.now() + FUTURE_DATE_CAP_MS;
  const sane = (iso: string | null): string | null => {
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) && ms <= cap ? iso : null;
  };
  return sane(a.resultDate) ?? sane(a.postedAt) ?? a.postedAt ?? new Date().toISOString();
}

function toTender(a: BidAssistAwardRaw): Tender {
  const stage = a.resultStage ?? prettyStage(a.awardStage);
  const descParts = [
    stage ? `Decision stage: ${stage}.` : "",
    a.matchedKeywords.length ? `Matched: ${a.matchedKeywords.join(", ")}.` : "",
    a.procurementSource ? `Source portal: ${a.procurementSource}.` : "",
    a.typeOfContract ? `Contract type: ${a.typeOfContract.toLowerCase()}.` : "",
    a.state ? `Location: ${a.state}.` : "",
  ].filter(Boolean);
  return {
    id: a.tenderId || a.awardId,
    refNo: a.refNo || a.tenderId,
    title: a.title || "Untitled tender result",
    buyer: a.buyer,
    description: descParts.join(" ") || "Tender result aggregated via BidAssist.",
    estimatedValue: typeof a.value === "number" && a.value > 0 ? a.value : undefined,
    bidders: [], // the public results listing doesn't name bidders
    resultDate: pickResultDate(a),
    status: "result_in",
    followUps: [],
    publishedAt: a.postedAt ?? "",
    sourcePortal: "BidAssist",
    sourceUrl: a.detailUrl,
    dataSource: "live",
  };
}

export async function loadBidAssistAwards(): Promise<BidAssistAwardsLoadResult> {
  try {
    const res = await fetch(RAW_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      return { tenders: [], fetchedAt: null, scanned: 0, stale: true, status: "missing" };
    }
    if (!res.ok) {
      return {
        tenders: [],
        fetchedAt: null,
        scanned: 0,
        stale: true,
        status: "error",
        error: `Fetch ${res.status}`,
      };
    }

    const payload = (await res.json()) as BidAssistAwardsPayload;
    const fetchedAtMs = new Date(payload.fetchedAt).getTime();
    const stale = !Number.isFinite(fetchedAtMs) || Date.now() - fetchedAtMs > STALE_AFTER_MS;
    const tenders = (payload.awards ?? []).map(toTender);

    return {
      tenders,
      fetchedAt: payload.fetchedAt,
      scanned: payload.totalScanned ?? 0,
      stale,
      status: payload.ok === false ? "error" : tenders.length === 0 ? "empty" : "ok",
      error: payload.error,
    };
  } catch (err) {
    return {
      tenders: [],
      fetchedAt: null,
      scanned: 0,
      stale: true,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
