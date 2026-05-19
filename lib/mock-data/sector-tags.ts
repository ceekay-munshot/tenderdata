import type { SectorTag } from "@/lib/types";

export const sectorTags: SectorTag[] = [
  {
    id: "visa-passport",
    label: "Visa & Passport Services",
    keywords: [
      "visa processing",
      "passport services",
      "consular support",
      "biometric enrolment",
      "citizen service kiosk",
      "outsourced consular operations",
      "VFS",
    ],
  },
  {
    id: "defence-electronics",
    label: "Defence Electronics",
    keywords: [
      "radar",
      "missile electronics",
      "electronic warfare",
      "secure communication",
      "naval electronics",
      "air defence",
    ],
  },
  {
    id: "aerospace",
    label: "Aerospace & Aviation",
    keywords: [
      "fighter aircraft",
      "helicopter",
      "LCA Tejas",
      "engine overhaul",
      "aviation MRO",
      "UAV",
    ],
  },
  {
    id: "railway-epc",
    label: "Railway EPC",
    keywords: [
      "track doubling",
      "electrification",
      "signalling",
      "freight corridor",
      "metro civil",
      "rolling stock",
    ],
  },
  {
    id: "infra-epc",
    label: "Infrastructure EPC",
    keywords: [
      "highway construction",
      "bridge",
      "ports & harbour",
      "water supply",
      "urban infra",
      "smart city",
    ],
  },
];

export const buyerOptions = [
  "Ministry of External Affairs",
  "Ministry of Defence",
  "Ministry of Railways",
  "Indian Air Force",
  "Indian Navy",
  "NHAI",
  "MoHUA",
  "SECI",
  "DRDO",
  "Embassy of India, Riyadh",
  "Embassy of India, Washington D.C.",
];

export const competitorOptions = [
  "VFS Global",
  "Alhind Group",
  "TLScontact",
  "CGI Inc.",
  "Honeywell India",
  "Thales India",
  "Tata Advanced Systems",
];
