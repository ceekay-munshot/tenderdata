import type { Tender, Update } from "@/lib/types";
import { tenders as rawTenders } from "./tenders";
import { watchlist, watchedTickers } from "./watchlist";

export { watchlist, watchedTickers } from "./watchlist";

/**
 * Seeded BLS-arc tenders, tagged as example data. These stay in the feed
 * (clearly badged) so the dashboard always demonstrates a fully-populated
 * tender — bidders, winner, follow-ups — for client walkthroughs, while
 * live scraped tenders flow in alongside them.
 */
export const exampleTenders: Tender[] = rawTenders.map((t) => ({
  ...t,
  dataSource: "example" as const,
}));

export function isWatched(ticker?: string): boolean {
  return !!ticker && watchedTickers.has(ticker);
}

/**
 * Sort any tender list for the feed: pending/evaluation first, then by
 * how close the result date is to now.
 */
export function sortTenders(list: Tender[]): Tender[] {
  const now = Date.now();
  return [...list].sort((a, b) => {
    const aPending = a.status === "pending" || a.status === "evaluation";
    const bPending = b.status === "pending" || b.status === "evaluation";
    if (aPending !== bPending) return aPending ? -1 : 1;
    return (
      Math.abs(new Date(a.resultDate).getTime() - now) -
      Math.abs(new Date(b.resultDate).getTime() - now)
    );
  });
}

/** Synthesise "Recent Updates" from the example tenders' results + follow-ups. */
export function getRecentUpdates(limit = 30): Update[] {
  const updates: Update[] = [];

  for (const t of exampleTenders) {
    if (t.status === "awarded" || t.status === "result_in") {
      updates.push({
        id: `${t.id}--result`,
        date: t.resultDate,
        tenderId: t.id,
        kind: "winner_announced",
        ticker: t.bidders.find((b) => b.status === "won")?.ticker,
        text: t.winner ? `${t.winner} won — ${t.title}` : `Result declared — ${t.title}`,
        tone: "positive",
        context: t.buyer,
      });
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
