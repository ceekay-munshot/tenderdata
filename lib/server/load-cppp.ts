/**
 * Runtime loader for scraped CPPP tenders.
 *
 * Like load-updates.ts: the GHA scraper commits data/cppp-tenders.json to
 * the `data` branch; the app fetches the raw URL at request time with ISR
 * caching. CpppTender (thin: no bidders/winner — CPPP doesn't expose those
 * pre-award) is adapted into the dashboard's richer Tender shape.
 */

import type { Tender, CpppTender } from "@/lib/types";

const OWNER = process.env.NEXT_PUBLIC_REPO_OWNER ?? "ceekay-munshot";
const REPO = process.env.NEXT_PUBLIC_REPO_NAME ?? "tenderdata";
const BRANCH = process.env.NEXT_PUBLIC_DATA_BRANCH ?? "data";

const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/data/cppp-tenders.json`;

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // tenders move slowly — 6h
const REVALIDATE_SECONDS = 120;

interface CpppPayload {
  fetchedAt: string;
  ok: boolean;
  error?: string;
  totalRowsParsed: number;
  relevantCount: number;
  tenders: CpppTender[];
}

export interface CpppLoadResult {
  /** Watchlist-matched tenders, adapted to the dashboard Tender shape. */
  tenders: Tender[];
  fetchedAt: string | null;
  /** Total CPPP rows scanned this run (matched + unmatched). */
  scanned: number;
  stale: boolean;
  status: "ok" | "empty" | "missing" | "error";
  error?: string;
}

/** Adapt a thin CpppTender into the dashboard's Tender shape. */
function cpppToTender(c: CpppTender): Tender {
  const resultDate = c.tenderOpensAt ?? c.bidSubmissionCloses ?? c.publishedAt ?? new Date().toISOString();
  return {
    id: c.tenderRef,
    refNo: c.tenderRef,
    title: c.title,
    buyer: c.buyer || c.organisationChain,
    description:
      c.matchedKeywords.length > 0
        ? `Matched watchlist sectors: ${c.matchedKeywords.join(", ")}.`
        : "Tender scraped from CPPP.",
    bidders: [], // CPPP does not publish bidders before award
    resultDate,
    status: "pending",
    followUps: [],
    publishedAt: c.publishedAt ?? "",
    sourcePortal: "CPPP",
    sourceUrl: c.detailUrl,
    dataSource: "live",
  };
}

export async function loadCpppTenders(): Promise<CpppLoadResult> {
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

    const payload = (await res.json()) as CpppPayload;
    const fetchedAtMs = new Date(payload.fetchedAt).getTime();
    const stale = !Number.isFinite(fetchedAtMs) || Date.now() - fetchedAtMs > STALE_AFTER_MS;
    const tenders = (payload.tenders ?? []).map(cpppToTender);

    return {
      tenders,
      fetchedAt: payload.fetchedAt,
      scanned: payload.totalRowsParsed ?? 0,
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
