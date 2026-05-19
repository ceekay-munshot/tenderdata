import type { Tender } from "@/lib/types";

// "Today" anchor: 2026-05-19. Tenders mix recent past + upcoming.
export const tenders: Tender[] = [
  // --- AWARDED: BLS lost UAE contract (the anchor case) ---
  {
    id: "t-mea-uae-visa",
    refNo: "MEA/CONSULAR/2025/UAE-019",
    title: "Outsourced Visa & Passport Services — Indian Missions in UAE",
    buyer: "Ministry of External Affairs",
    ministry: "MEA",
    description:
      "Five-year outsourcing contract for visa and passport services across Indian missions in UAE (Abu Dhabi, Dubai, consulate operations).",
    estimatedValue: 320_00_00_000,
    bidders: [
      { name: "BLS International", ticker: "BLS", status: "lost" },
      { name: "Alhind Group", status: "won" },
      { name: "VFS Global", status: "lost" },
    ],
    resultDate: "2026-05-05T11:30:00+05:30",
    status: "awarded",
    winner: "Alhind Group",
    publishedAt: "2026-01-15T10:00:00+05:30",
    sourcePortal: "CPPP",
    sourceUrl: "https://eprocure.gov.in/eprocure/app",
    followUps: [
      {
        id: "fu-bls-loss-disclosure",
        date: "2026-05-08T17:12:00+05:30",
        kind: "sebi_disclosure",
        ticker: "BLS",
        text: "BLS confirms loss of UAE contract — disclosed UAE was 12.8% of FY25 revenue.",
        tone: "negative",
        source: "BSE",
      },
      {
        id: "fu-bls-mea-debar",
        date: "2026-05-15T18:42:00+05:30",
        kind: "ban",
        ticker: "BLS",
        text: "MEA debarred BLS from all ministry tenders for 2 years — citing breach of UAE contract obligations.",
        tone: "negative",
        source: "MEA Order",
      },
    ],
  },

  // --- PENDING: BLS Morocco bid, T-7 days ---
  {
    id: "t-mea-morocco-visa",
    refNo: "MEA/CONSULAR/2026/MOR-014",
    title: "Visa & Passport Outsourcing — Embassy of India, Rabat (Morocco)",
    buyer: "Ministry of External Affairs",
    ministry: "MEA",
    description:
      "Selection of agency for visa, passport and consular services in Morocco for 5 years. Includes biometric enrolment + service kiosks in Casablanca and Tangier.",
    estimatedValue: 84_50_00_000,
    bidders: [
      { name: "BLS International", ticker: "BLS", status: "applied" },
      { name: "VFS Global", status: "applied" },
      { name: "TLScontact", status: "applied" },
    ],
    resultDate: "2026-05-26T11:30:00+05:30",
    status: "evaluation",
    publishedAt: "2026-03-12T10:00:00+05:30",
    sourcePortal: "CPPP",
    sourceUrl: "https://eprocure.gov.in/eprocure/app",
    followUps: [],
  },

  // --- PENDING: MoD Radar, BEL qualified, T-21 days ---
  {
    id: "t-mod-radar",
    refNo: "MoD/IAF/RADAR/2026/77",
    title: "35 Light Mountain Radar Systems — Indian Air Force",
    buyer: "Ministry of Defence",
    ministry: "MoD",
    description:
      "Supply, install and 7-year MRO support for 35 light mountain radars at forward IAF bases (Northern Command).",
    estimatedValue: 2480_00_00_000,
    bidders: [
      { name: "Bharat Electronics", ticker: "BEL", status: "qualified" },
      { name: "Tata Advanced Systems", status: "qualified" },
    ],
    resultDate: "2026-06-09T11:30:00+05:30",
    status: "evaluation",
    publishedAt: "2026-02-28T10:00:00+05:30",
    sourcePortal: "CPPP",
    followUps: [],
  },

  // --- RESULT IN: HAL LOI for Sukhoi MRO, very recent ---
  {
    id: "t-mod-sukhoi-engine",
    refNo: "MoD/IAF/ENGINE-MRO/2026/12",
    title: "Sukhoi-30 MKI AL-31FP Engine Overhaul Programme — 5 Year Contract",
    buyer: "Indian Air Force",
    ministry: "MoD",
    description:
      "Comprehensive overhaul and major repair contract for AL-31FP engines fitted on Sukhoi-30 MKI fleet, plus spares supply.",
    estimatedValue: 6850_00_00_000,
    bidders: [{ name: "Hindustan Aeronautics", ticker: "HAL", status: "won" }],
    resultDate: "2026-05-19T12:15:00+05:30",
    status: "result_in",
    winner: "Hindustan Aeronautics",
    publishedAt: "2026-03-04T10:00:00+05:30",
    sourcePortal: "CPPP",
    followUps: [
      {
        id: "fu-hal-loi",
        date: "2026-05-19T12:15:00+05:30",
        kind: "loi",
        ticker: "HAL",
        text: "HAL received Letter of Intent — definitive contract signing expected within 60 days.",
        tone: "positive",
        source: "BSE",
      },
    ],
  },

  // --- AWARDED: RVNL won Eastern DFC, recent ---
  {
    id: "t-rail-dfc-east",
    refNo: "DFCCIL/EAST/2026/KH-BH",
    title: "Eastern DFC — New Khurja to New Bhaupur Section",
    buyer: "Dedicated Freight Corridor Corporation",
    ministry: "MoR",
    description:
      "Construction of New Khurja–New Bhaupur section of the Eastern Dedicated Freight Corridor — 30-month execution.",
    estimatedValue: 1684_00_00_000,
    bidders: [
      { name: "Rail Vikas Nigam", ticker: "RVNL", status: "won" },
      { name: "IRCON International", ticker: "IRCON", status: "lost" },
      { name: "KEC International", status: "lost" },
    ],
    resultDate: "2026-05-17T15:22:00+05:30",
    status: "awarded",
    winner: "Rail Vikas Nigam",
    publishedAt: "2026-02-10T10:00:00+05:30",
    sourcePortal: "CPPP",
    followUps: [
      {
        id: "fu-rvnl-loa",
        date: "2026-05-17T15:22:00+05:30",
        kind: "contract_signed",
        ticker: "RVNL",
        text: "RVNL received Letter of Award (LOA) for ₹1,684 Cr contract.",
        tone: "positive",
        source: "BSE",
      },
    ],
  },

  // --- PENDING: Mumbai-Pune doubling, T-34 days ---
  {
    id: "t-rail-mum-pune",
    refNo: "RAIL/CR/DBL/2026/MUM-PUNE-2",
    title: "Mumbai–Pune Track Doubling Phase II (Civil + Electrification)",
    buyer: "Ministry of Railways",
    ministry: "MoR",
    description:
      "EPC contract for doubling Mumbai–Pune railway section Phase II: 92km of civil works, OHE electrification, signalling upgrade.",
    estimatedValue: 3120_00_00_000,
    bidders: [
      { name: "Rail Vikas Nigam", ticker: "RVNL", status: "applied" },
      { name: "IRCON International", ticker: "IRCON", status: "applied" },
      { name: "L&T Construction", ticker: "LT", status: "applied" },
      { name: "KEC International", status: "applied" },
    ],
    resultDate: "2026-06-22T11:30:00+05:30",
    status: "pending",
    publishedAt: "2026-04-02T10:00:00+05:30",
    sourcePortal: "CPPP",
    followUps: [],
  },

  // --- PENDING: BLS Saudi visa, T-37 days ---
  {
    id: "t-mea-saudi-visa",
    refNo: "MEA/CONSULAR/2026/KSA-008",
    title: "Visa Application Centres — Embassy of India, Riyadh & Consulate Jeddah",
    buyer: "Embassy of India, Riyadh",
    ministry: "MEA",
    description:
      "Operation of visa centres in Riyadh, Jeddah and Dammam for 5 years — biometric capture, document handling, labour-visa processing.",
    estimatedValue: 215_00_00_000,
    bidders: [
      { name: "BLS International", ticker: "BLS", status: "applied" },
      { name: "VFS Global", status: "applied" },
    ],
    resultDate: "2026-06-25T11:30:00+05:30",
    status: "pending",
    publishedAt: "2026-04-18T10:00:00+05:30",
    sourcePortal: "CPPP",
    followUps: [],
  },

  // --- PENDING: Mumbai Metro underground, T-47 days ---
  {
    id: "t-metro-mumbai-ug08",
    refNo: "MMRC/CIVIL/UG-08/2026",
    title: "Mumbai Metro Line 6 — Underground Civil Package UG-08",
    buyer: "Mumbai Metro Rail Corporation",
    description:
      "Design + construction of 3.4 km of tunnels and 4 stations using EPBM tunnel boring methodology.",
    estimatedValue: 1840_00_00_000,
    bidders: [
      { name: "IRCON International", ticker: "IRCON", status: "applied" },
      { name: "L&T Construction", ticker: "LT", status: "applied" },
      { name: "Afcons Infrastructure", status: "applied" },
    ],
    resultDate: "2026-07-05T11:30:00+05:30",
    status: "pending",
    publishedAt: "2026-04-25T10:00:00+05:30",
    sourcePortal: "State",
    followUps: [],
  },

  // --- PENDING: Navy comms, BEL competing, T-54 days ---
  {
    id: "t-mod-navy-comms",
    refNo: "MoD/NAVY/COMMS/2026/41",
    title: "Secure Naval Communication Suites — 12 Project-17B Frigates",
    buyer: "Indian Navy",
    ministry: "MoD",
    description:
      "Supply and integration of secure software-defined radio communication suites + encrypted satcom + tactical data link.",
    estimatedValue: 1240_00_00_000,
    bidders: [
      { name: "Bharat Electronics", ticker: "BEL", status: "applied" },
      { name: "Honeywell India", status: "applied" },
      { name: "Thales India", status: "applied" },
    ],
    resultDate: "2026-07-12T11:30:00+05:30",
    status: "pending",
    publishedAt: "2026-05-02T10:00:00+05:30",
    sourcePortal: "GeM",
    followUps: [],
  },
];

export const tendersById = Object.fromEntries(tenders.map((t) => [t.id, t]));
