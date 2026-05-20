/**
 * Sector keyword filter — the v1 "semantic" filter for tenders.
 *
 * CPPP publishes thousands of tenders; we keep only those whose title/org
 * maps to a watchlist sector. Two hard-won rules from real data:
 *
 *  1. Match on WORD BOUNDARIES, never raw substring. Substring matching
 *     flagged "SCADA for VISAKHapatnam pipeline" because "visa" sits inside
 *     "Visakhapatnam". \b...\b fixes that class of false positive.
 *  2. Prefer SPECIFIC multi-word phrases. Bare "radar" matched an
 *     industrial "(RADAR) level instrument"; bare "metro rail" matched a
 *     metro corporation's video-conferencing tender via its org name.
 *     "radar system" / "metro rail project" don't.
 *
 * An embedding-based filter can later replace matchTenderKeywords without
 * touching callers.
 */

export interface SectorDef {
  id: string;
  label: string;
  /** Watchlist tickers operating in this sector. */
  tickers: string[];
  /** Keyword phrases, matched whole-word, case-insensitive. */
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
      "e-visa",
      "visa application",
      "passport seva",
      "biometric enrolment",
      "biometric enrollment",
      "citizen service centre",
    ],
  },
  {
    id: "defence-electronics",
    label: "Defence Electronics",
    tickers: ["BEL"],
    keywords: [
      "radar system",
      "surveillance radar",
      "air defence",
      "weapon locating radar",
      "electronic warfare",
      "missile system",
      "electro-optic",
      "sonar system",
      "naval communication system",
      "command and control system",
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
      "fighter aircraft",
      "rotary wing",
      "avionics",
      "aircraft overhaul",
    ],
  },
  {
    id: "railway",
    label: "Railway Infrastructure",
    tickers: ["RVNL", "IRCON"],
    keywords: [
      "railway electrification",
      "track doubling",
      "doubling of railway",
      "rail signalling",
      "gauge conversion",
      "freight corridor",
      "new railway line",
      "metro rail project",
      "metro corridor",
      "overhead equipment",
      "railway bridge",
    ],
  },
  {
    id: "heavy-epc",
    label: "Heavy EPC & Power",
    tickers: ["LT"],
    keywords: [
      "expressway",
      "thermal power plant",
      "transmission line",
      "coal gasification",
      "hydroelectric",
      "tunnel construction",
      "water treatment plant",
    ],
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface CompiledKeyword {
  keyword: string;
  sectorId: string;
  re: RegExp;
}

// Each keyword -> /\bkeyword(s|es)?\b/i : whole-word, plural-tolerant.
const COMPILED: CompiledKeyword[] = SECTORS.flatMap((s) =>
  s.keywords.map((k) => ({
    keyword: k,
    sectorId: s.id,
    re: new RegExp(`\\b${escapeRegExp(k)}(?:s|es)?\\b`, "i"),
  })),
);

export interface KeywordMatch {
  matchedKeywords: string[];
  sectorIds: string[];
  tickers: string[];
}

/**
 * Match free text (tender title + org chain) against the sector keyword
 * index. Empty arrays = not relevant.
 */
export function matchTenderKeywords(...textParts: (string | null | undefined)[]): KeywordMatch {
  const haystack = textParts.filter(Boolean).join("  ");

  const matchedKeywords = new Set<string>();
  const sectorIds = new Set<string>();
  for (const { keyword, sectorId, re } of COMPILED) {
    if (re.test(haystack)) {
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
