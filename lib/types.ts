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
