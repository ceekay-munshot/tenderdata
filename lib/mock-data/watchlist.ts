import type { WatchlistItem } from "@/lib/types";

export const watchlist: WatchlistItem[] = [
  { ticker: "BLS", name: "BLS International Services", exchange: "BSE", sector: "Visa & Passport Services", addedAt: "2026-02-10T09:00:00+05:30" },
  { ticker: "BEL", name: "Bharat Electronics", exchange: "NSE", sector: "Defence Electronics", addedAt: "2026-02-12T09:00:00+05:30" },
  { ticker: "HAL", name: "Hindustan Aeronautics", exchange: "NSE", sector: "Aerospace & Defence", addedAt: "2026-02-12T09:00:00+05:30" },
  { ticker: "RVNL", name: "Rail Vikas Nigam", exchange: "NSE", sector: "Railway EPC", addedAt: "2026-02-15T09:00:00+05:30" },
  { ticker: "IRCON", name: "IRCON International", exchange: "NSE", sector: "Railway EPC", addedAt: "2026-02-15T09:00:00+05:30" },
  { ticker: "LT", name: "Larsen & Toubro", exchange: "NSE", sector: "Engineering & Construction", addedAt: "2026-03-01T09:00:00+05:30" },
];

export const watchedTickers = new Set(watchlist.map((w) => w.ticker));
