export { companies, companyList } from "./companies";
export { sectorTags, buyerOptions, competitorOptions } from "./sector-tags";
export { tenders, tendersById } from "./tenders";
export { disclosures, disclosuresByTicker } from "./disclosures";

import { tenders } from "./tenders";
import { disclosures } from "./disclosures";
import type { SignalEvent } from "@/lib/types";

// Derive a flat upcoming-events stream for the calendar + dashboard
export function getUpcomingEvents(daysAhead = 60): SignalEvent[] {
  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const events: SignalEvent[] = [];

  for (const t of tenders) {
    for (const m of t.milestones) {
      const d = new Date(m.date);
      if (d < now || d > horizon) continue;
      const severity =
        m.type === "financial_bid_opening" ? "critical"
        : m.type === "technical_evaluation" ? "warning"
        : "neutral";
      events.push({
        id: `${t.id}-${m.type}`,
        ticker: t.watchedCompanies[0],
        type: "tender_milestone",
        title: `${labelFor(m.type)} — ${t.title.split("—")[0].trim()}`,
        description: t.buyer,
        severity,
        date: m.date,
        source: t.sourcePortal,
        linkedId: t.id,
      });
    }
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function labelFor(type: string): string {
  switch (type) {
    case "bid_submission":
      return "Bid Submission";
    case "technical_evaluation":
      return "Technical Evaluation";
    case "financial_bid_opening":
      return "Financial Bid Opening";
    case "result_announcement":
      return "Result Announcement";
    default:
      return type;
  }
}

export function getRecentDisclosures(limit = 20) {
  return [...disclosures].sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime()).slice(0, limit);
}
