/**
 * Sector keyword filter — the v1 "semantic" filter for tenders.
 *
 * CPPP publishes thousands of tenders a day. We can't show all of them, so
 * we keep only tenders whose title/org matches a watchlist sector. This is
 * deliberately keyword-based for now (cheap, no API, runs anywhere); an
 * embedding-based filter can replace `matchTenderKeywords` later without
 * touching callers.
 *
 * Keywords are intentionally specific multi-word phrases where possible —
 * bare words like "construction" or "service" would match half of CPPP and
 * bring back the keyword-blindness problem we're trying to avoid.
 */

export interface SectorDef {
  id: string;
  label: string;
  /** Watchlist tickers that operate in this sector */
  tickers: string[];
  /** Lower-cased phrases; a tender matches if its text contains any */
  keywords: string[];
}

export const SECTORS: SectorDef[] = [
  {
    id: "visa-consular",
    label: "Visa, Passport & Consular",
    tickers: ["BLS"],
    keywords: [
      "visa",
      "passport",
      "consular",
      "biometric enrolment",
      "biometric enrollment",
      "visa application",
      "citizen service centre",
      "e-visa",
      "passport seva",
    ],
  },
  {
    id: "defence-electronics",
    label: "Defence Electronics",
    tickers: ["BEL"],
    keywords: [
      "radar",
      "electronic warfare",
      "missile system",
      "sonar",
      "secure communication",
      "electro-optic",
      "electro optic",
      "fire control system",
      "naval electronics",
      "air defence",
    ],
  },
  {
    id: "aerospace",
    label: "Aerospace & Aviation",
    tickers: ["HAL"],
    keywords: [
      "aircraft",
      "helicopter",
      "aero engine",
      "aero-engine",
      "aircraft overhaul",
      "fighter aircraft",
      "rotary wing",
      "aviation mro",
    ],
  },
  {
    id: "railway",
    label: "Railway Infrastructure",
    tickers: ["RVNL", "IRCON"],
    keywords: [
      "railway electrification",
      "track doubling",
      "rail signalling",
      "railway construction",
      "metro rail",
      "freight corridor",
      "new railway line",
      "overhead equipment",
      "gauge conversion",
      "rail flyover",
    ],
  },
  {
    id: "heavy-epc",
    label: "Heavy EPC & Power",
    tickers: ["LT"],
    keywords: [
      "expressway",
      "metro rail",
      "thermal power",
      "transmission line",
      "water supply project",
      "coal gasification",
      "hydroelectric",
      "tunnel construction",
      "smart city",
    ],
  },
];

/** Flat keyword -> sector id index, for fast lookup. */
const KEYWORD_INDEX: { keyword: string; sectorId: string }[] = SECTORS.flatMap((s) =>
  s.keywords.map((k) => ({ keyword: k.toLowerCase(), sectorId: s.id })),
);

export interface KeywordMatch {
  matchedKeywords: string[];
  sectorIds: string[];
  tickers: string[];
}

/**
 * Match free text (a tender title + org chain) against the sector keyword
 * index. Returns the matched keywords, sectors, and the watchlist tickers
 * those sectors map to. Empty arrays = not relevant, drop the tender.
 */
export function matchTenderKeywords(...textParts: (string | null | undefined)[]): KeywordMatch {
  const haystack = textParts.filter(Boolean).join("  ").toLowerCase();

  const matchedKeywords = new Set<string>();
  const sectorIds = new Set<string>();
  for (const { keyword, sectorId } of KEYWORD_INDEX) {
    if (haystack.includes(keyword)) {
      matchedKeywords.add(keyword);
      sectorIds.add(sectorId);
    }
  }

  const tickers = new Set<string>();
  for (const s of SECTORS) {
    if (sectorIds.has(s.id)) s.tickers.forEach((t) => tickers.add(t));
  }

  return {
    matchedKeywords: [...matchedKeywords],
    sectorIds: [...sectorIds],
    tickers: [...tickers],
  };
}
