/**
 * Runtime loader for scraped BidAssist tenders.
 *
 * The GHA scraper commits data/bidassist-tenders.json to the `data`
 * branch; the app fetches the raw URL at request time with ISR caching
 * and adapts each tender into the dashboard's Tender shape.
 *
 * BidAssist is an aggregator — each tender carries the original portal
 * it came from (procurementSource), surfaced in the description.
 */

import type { Tender } from "@/lib/types";

const OWNER = process.env.NEXT_PUBLIC_REPO_OWNER ?? "ceekay-munshot";
const REPO = process.env.NEXT_PUBLIC_REPO_NAME ?? "tenderdata";
const BRANCH = process.env.NEXT_PUBLIC_DATA_BRANCH ?? "data";

const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/data/bidassist-tenders.json`;

const STALE_AFTER_MS = 8 * 60 * 60 * 1000; // 8h
const REVALIDATE_SECONDS = 120;

interface BidAssistTenderRaw {
  tenderId: string;
  refNo: string;
  title: string;
  buyer: string;
  purchaserGroup?: string;
  procurementSource?: string;
  state?: string;
  value?: number;
  emd?: number;
  bidDeadline: string | null;
  postedAt: string | null;
  sectorNames: string[];
  detailUrl?: string;
  matchedKeywords: string[];
}

interface BidAssistPayload {
  fetchedAt: string;
  ok: boolean;
  error?: string;
  apiCalls: number;
  totalScanned: number;
  relevantCount: number;
  tenders: BidAssistTenderRaw[];
}

export interface BidAssistLoadResult {
  /** Watchlist-matched tenders, adapted to the dashboard Tender shape. */
  tenders: Tender[];
  fetchedAt: string | null;
  /** Total tenders scanned this run (matched + unmatched). */
  scanned: number;
  stale: boolean;
  status: "ok" | "empty" | "missing" | "error";
  error?: string;
}

function toTender(b: BidAssistTenderRaw): Tender {
  const descParts = [
    b.matchedKeywords.length ? `Matched: ${b.matchedKeywords.join(", ")}.` : "",
    b.procurementSource ? `Source portal: ${b.procurementSource}.` : "",
    b.state ? `Location: ${b.state}.` : "",
  ].filter(Boolean);
  return {
    id: b.tenderId || b.refNo,
    refNo: b.refNo || b.tenderId,
    title: b.title || "Untitled tender",
    buyer: b.buyer,
    description: descParts.join(" ") || "Tender aggregated via BidAssist.",
    estimatedValue: typeof b.value === "number" && b.value > 0 ? b.value : undefined,
    bidders: [], // BidAssist's listing doesn't expose bidders pre-award
    resultDate: b.bidDeadline ?? b.postedAt ?? new Date().toISOString(),
    status: "pending",
    followUps: [],
    publishedAt: b.postedAt ?? "",
    sourcePortal: "BidAssist",
    sourceUrl: b.detailUrl,
    dataSource: "live",
  };
}

export async function loadBidAssistTenders(): Promise<BidAssistLoadResult> {
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

    const payload = (await res.json()) as BidAssistPayload;
    const fetchedAtMs = new Date(payload.fetchedAt).getTime();
    const stale = !Number.isFinite(fetchedAtMs) || Date.now() - fetchedAtMs > STALE_AFTER_MS;
    const tenders = (payload.tenders ?? []).map(toTender);

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
