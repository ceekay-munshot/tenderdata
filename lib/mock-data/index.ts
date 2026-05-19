import type { Tender, Update } from "@/lib/types";
import { tenders } from "./tenders";
import { watchlist, watchedTickers } from "./watchlist";

export { tenders, tendersById } from "./tenders";
export { watchlist, watchedTickers } from "./watchlist";

/** Synthesise the "Recent Updates" stream from tender results + follow-ups. */
export function getRecentUpdates(limit = 30): Update[] {
  const updates: Update[] = [];

  for (const t of tenders) {
    // Result declared event
    if (t.status === "awarded" || t.status === "result_in") {
      updates.push({
        id: `${t.id}--result`,
        date: t.resultDate,
        tenderId: t.id,
        kind: "winner_announced",
        ticker: t.bidders.find((b) => b.status === "won")?.ticker,
        text: t.winner
          ? `${t.winner} won — ${t.title}`
          : `Result declared — ${t.title}`,
        tone: "positive",
        context: t.buyer,
      });

      // Each loser is its own update (so watchlist hits surface)
      for (const b of t.bidders) {
        if (b.status === "lost") {
          updates.push({
            id: `${t.id}--lost-${b.ticker ?? b.name}`,
            date: t.resultDate,
            tenderId: t.id,
            kind: "loser_confirmed",
            ticker: b.ticker,
            text: `${b.name} lost — contract awarded to ${t.winner ?? "another bidder"}`,
            tone: "negative",
            context: t.title,
          });
        }
      }
    }

    // Follow-ups (ban, penalty, LOI, etc.)
    for (const fu of t.followUps) {
      updates.push({
        id: fu.id,
        date: fu.date,
        tenderId: t.id,
        kind: "follow_up",
        ticker: fu.ticker,
        text: fu.text,
        tone: fu.tone,
        context: t.title,
      });
    }
  }

  return updates
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

export function isWatched(ticker?: string): boolean {
  return !!ticker && watchedTickers.has(ticker);
}

/** Tenders sorted by relevance: pending soonest first, then result_in, then recently awarded. */
export function sortedTenders(): Tender[] {
  const now = Date.now();
  return [...tenders].sort((a, b) => {
    const aPending = a.status === "pending" || a.status === "evaluation";
    const bPending = b.status === "pending" || b.status === "evaluation";
    if (aPending !== bPending) return aPending ? -1 : 1;
    return Math.abs(new Date(a.resultDate).getTime() - now) - Math.abs(new Date(b.resultDate).getTime() - now);
  });
}
