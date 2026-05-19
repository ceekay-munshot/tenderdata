export type Severity = "critical" | "positive" | "warning" | "neutral";

export type MilestoneType =
  | "bid_submission"
  | "technical_evaluation"
  | "financial_bid_opening"
  | "result_announcement";

export interface Company {
  ticker: string;
  name: string;
  exchange: "BSE" | "NSE";
  sector: string;
  industry: string;
  marketCap: number; // in INR
  lastPrice: number;
  change: number; // percentage
  volume: number;
  // Tender concentration risk score (0-100): higher = more dependent on a single contract
  concentrationRisk: number;
  // Live signal score (0-100): aggregated alert intensity
  signalScore: number;
  about?: string;
}

export interface SectorTag {
  id: string;
  label: string;
  // Semantic keywords used by the AI filter
  keywords: string[];
}

export interface Watchlist {
  id: string;
  name: string;
  companies: string[]; // ticker list
  buyers?: string[]; // e.g. "Ministry of External Affairs"
  competitors?: string[]; // e.g. "VFS Global"
  createdAt: string;
}

export interface TenderMilestone {
  type: MilestoneType;
  date: string; // ISO
  description?: string;
}

export interface Tender {
  id: string;
  refNo: string;
  title: string;
  buyer: string; // e.g. "Ministry of External Affairs"
  ministry?: string;
  description: string;
  estimatedValue?: number; // INR
  sectorTagIds: string[];
  // Companies on our watchlist that are involved in some way
  watchedCompanies: string[]; // tickers
  // Bidders if known
  knownBidders?: string[];
  competitorBidders?: string[];
  milestones: TenderMilestone[];
  status: "upcoming" | "bidding_open" | "evaluation" | "financial_opened" | "awarded" | "cancelled";
  publishedAt: string;
  sourcePortal: "CPPP" | "GeM" | "State" | "BidAssist";
  sourceUrl?: string;
  // Semantic match confidence 0-100
  matchScore: number;
}

export interface Disclosure {
  id: string;
  ticker: string;
  companyName: string;
  exchange: "BSE" | "NSE";
  title: string;
  body: string;
  severity: Severity;
  category: "contract_win" | "contract_loss" | "regulatory" | "governance" | "financial" | "structural" | "other";
  triggerWords: string[];
  filedAt: string;
  url?: string;
  // If this disclosure mentions a tender, we link it back
  linkedTenderId?: string;
  // AI-tagged price impact prediction
  predictedImpact: "high" | "medium" | "low";
}

export interface AlertRule {
  id: string;
  name: string;
  trigger: "financial_bid_opening" | "disclosure_critical" | "disclosure_positive" | "result_announcement";
  leadTimeHours: number; // e.g. 48
  channels: ("telegram" | "email" | "slack" | "webhook")[];
  enabled: boolean;
}

export interface SignalEvent {
  id: string;
  ticker: string;
  type: "tender_milestone" | "disclosure" | "competitor_action" | "regulatory";
  title: string;
  description: string;
  severity: Severity;
  date: string;
  source?: string;
  linkedId?: string;
}
