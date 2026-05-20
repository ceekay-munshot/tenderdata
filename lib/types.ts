export type BidderStatus =
  | "applied"
  | "qualified"
  | "disqualified"
  | "won"
  | "lost"
  | "unknown";

export interface Bidder {
  name: string;
  /** BSE/NSE ticker if listed in India */
  ticker?: string;
  status: BidderStatus;
}

export type TenderStatus =
  | "pending" // result not yet announced
  | "evaluation" // technical eval done, financial bid scheduled
  | "result_in" // result just dropped, contract not yet inked
  | "awarded" // contract awarded
  | "cancelled";

export type FollowUpKind =
  | "ban"
  | "penalty"
  | "sebi_disclosure"
  | "news"
  | "loi"
  | "contract_signed";

export interface FollowUp {
  id: string;
  date: string; // ISO
  kind: FollowUpKind;
  ticker?: string;
  text: string;
  tone: "positive" | "negative" | "neutral";
  source?: string;
}

export interface Tender {
  id: string;
  refNo: string;
  title: string;
  buyer: string; // ministry / PSU
  ministry?: string;
  description: string;
  estimatedValue?: number; // INR
  bidders: Bidder[];
  /** The headline date — when the result will be (or was) announced */
  resultDate: string; // ISO
  status: TenderStatus;
  /** Set when status === "result_in" or "awarded" */
  winner?: string;
  followUps: FollowUp[];
  publishedAt: string;
  sourcePortal: "CPPP" | "GeM" | "State";
  sourceUrl?: string;
  /** "live" = scraped from a real portal; "example" = seeded demo data.
   *  Absent is treated as "example". */
  dataSource?: "live" | "example";
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  exchange: "BSE" | "NSE";
  sector?: string;
  addedAt: string;
}

/** A flattened "what just happened" event for the Recent Updates strip */
export interface Update {
  id: string;
  date: string;
  tenderId: string;
  kind:
    | "result_declared"
    | "winner_announced"
    | "loser_confirmed"
    | "follow_up";
  ticker?: string;
  text: string;
  tone: "positive" | "negative" | "neutral";
  context?: string; // e.g. tender title for breadcrumb
}

/**
 * A tender as scraped from CPPP (eprocure.gov.in).
 *
 * CPPP's "Latest Active Tenders" listing gives us titles, the org chain,
 * and the key dates — but not bidders, winner, or estimated value (those
 * live in the detail page / award documents and come in a later pass).
 */
export interface CpppTender {
  /** CPPP tender reference / tender ID */
  tenderRef: string;
  title: string;
  /** Full org chain, e.g. "Ministry of Defence||Bharat Electronics Limited" */
  organisationChain: string;
  /** First, most meaningful segment of the org chain */
  buyer: string;
  publishedAt: string | null; // ISO
  /** Last date to submit bids */
  bidSubmissionCloses: string | null; // ISO
  /** When bids are opened — proxy for the result/D-day */
  tenderOpensAt: string | null; // ISO
  detailUrl?: string;
  /** Sector keywords that matched this tender (the v1 "semantic" filter) */
  matchedKeywords: string[];
}
