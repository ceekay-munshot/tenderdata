import type { Disclosure } from "@/lib/types";

// Today: 2026-05-19. Recent disclosures span the past 30 days.
export const disclosures: Disclosure[] = [
  {
    id: "disc-bls-debar",
    ticker: "BLS",
    companyName: "BLS International Services",
    exchange: "BSE",
    title: "Debarment Order — Ministry of External Affairs",
    body:
      "Pursuant to Regulation 30 of the SEBI (LODR) Regulations, we hereby inform you that the Company has received a communication from the Ministry of External Affairs, Government of India, dated 15 May 2026, debarring BLS International Services Limited from participating in any tender process floated by MEA or its missions abroad for a period of two (2) years on account of breach of contractual obligations during the UAE visa services contract.",
    severity: "critical",
    category: "regulatory",
    triggerWords: ["Debarred", "Tender process", "Two years", "Breach"],
    filedAt: "2026-05-15T18:42:00+05:30",
    predictedImpact: "high",
    url: "https://bseindia.com/corporates/ann.html",
  },
  {
    id: "disc-bls-uae-loss",
    ticker: "BLS",
    companyName: "BLS International Services",
    exchange: "BSE",
    title: "Loss of UAE Visa Outsourcing Contract — Disclosure under Reg 30",
    body:
      "We wish to inform that the Company has not been declared the L1 bidder in the financial bid opening conducted on 5 May 2026 for the renewal of UAE visa services contract under the Ministry of External Affairs. The contract has been awarded to Alhind Group. The UAE business contributed approximately 12.8% to the Company's consolidated revenue in FY25.",
    severity: "critical",
    category: "contract_loss",
    triggerWords: ["Lost Contract", "Not L1", "12.8% revenue"],
    filedAt: "2026-05-08T17:12:00+05:30",
    linkedTenderId: "tender-bls-uae",
    predictedImpact: "high",
  },
  {
    id: "disc-bls-morocco-bid",
    ticker: "BLS",
    companyName: "BLS International Services",
    exchange: "BSE",
    title: "Participation in Morocco Visa Services Tender",
    body:
      "The Company is pleased to inform that it has successfully submitted its technical and financial bid for the Embassy of India, Rabat (Morocco) visa & passport outsourcing tender floated by the Ministry of External Affairs. Estimated contract value is INR 84.5 crores over 5 years. Financial bid opening is scheduled for 26 May 2026.",
    severity: "positive",
    category: "contract_win",
    triggerWords: ["Bid Submitted", "Financial bid opening"],
    filedAt: "2026-04-23T11:08:00+05:30",
    linkedTenderId: "tender-bls-morocco",
    predictedImpact: "medium",
  },
  {
    id: "disc-bel-radar-shortlist",
    ticker: "BEL",
    companyName: "Bharat Electronics",
    exchange: "NSE",
    title: "Qualified in Technical Evaluation — Light Mountain Radar Programme",
    body:
      "Bharat Electronics Limited has been declared technically qualified in the MoD light mountain radar programme (Ref: MoD/IAF/RADAR/2026/77). The financial bid opening is scheduled for 09 June 2026. Tata Advanced Systems is the other technically qualified bidder. Estimated contract value: INR 2,480 crores.",
    severity: "positive",
    category: "contract_win",
    triggerWords: ["Technically Qualified", "Financial bid opening", "Shortlisted"],
    filedAt: "2026-05-22T16:35:00+05:30",
    linkedTenderId: "tender-bel-radar",
    predictedImpact: "high",
  },
  {
    id: "disc-rvnl-loi",
    ticker: "RVNL",
    companyName: "Rail Vikas Nigam",
    exchange: "NSE",
    title: "Letter of Award — Eastern Dedicated Freight Corridor Section",
    body:
      "RVNL has received Letter of Award (LOA) from Dedicated Freight Corridor Corporation of India Limited (DFCCIL) for the construction of the New Khurja–New Bhaupur section of the Eastern DFC. Contract value: INR 1,684 crores. Project execution period: 30 months.",
    severity: "positive",
    category: "contract_win",
    triggerWords: ["Letter of Award", "LOA", "Awarded"],
    filedAt: "2026-05-17T15:22:00+05:30",
    predictedImpact: "medium",
  },
  {
    id: "disc-hal-order",
    ticker: "HAL",
    companyName: "Hindustan Aeronautics",
    exchange: "NSE",
    title: "Receipt of LOI — Sukhoi-30 MKI Engine Overhaul Programme",
    body:
      "Hindustan Aeronautics has received a Letter of Intent from the Indian Air Force for the 5-year AL-31FP engine overhaul programme. Contract value: INR 6,850 crores. Definitive contract is expected to be signed within 60 days post financial bid opening on 18 June 2026.",
    severity: "positive",
    category: "contract_win",
    triggerWords: ["LOI", "Letter of Intent"],
    filedAt: "2026-05-19T12:15:00+05:30",
    linkedTenderId: "tender-hal-engine",
    predictedImpact: "high",
  },
  {
    id: "disc-bls-auditor",
    ticker: "BLS",
    companyName: "BLS International Services",
    exchange: "BSE",
    title: "Resignation of Statutory Auditor",
    body:
      "We inform you that M/s Walker Chandiok & Co. LLP has tendered their resignation as statutory auditors of the Company with effect from 18 May 2026 citing 'pre-occupation and reallocation of resources'. The Board has initiated the process of appointing a new statutory auditor.",
    severity: "warning",
    category: "governance",
    triggerWords: ["Resignation", "Statutory Auditor"],
    filedAt: "2026-05-18T19:48:00+05:30",
    predictedImpact: "medium",
  },
  {
    id: "disc-lt-mega",
    ticker: "LT",
    companyName: "Larsen & Toubro",
    exchange: "NSE",
    title: "Order Win — Brahmaputra Bridge Approach Roads Package",
    body:
      "L&T Construction has secured an order valued at INR 2,210 crores from the Ministry of Road Transport & Highways for the construction of approach roads and ancillary works for the new Brahmaputra bridge. Execution period: 36 months.",
    severity: "positive",
    category: "contract_win",
    triggerWords: ["Order Win", "Awarded"],
    filedAt: "2026-05-14T11:02:00+05:30",
    predictedImpact: "low",
  },
  {
    id: "disc-ircon-penalty",
    ticker: "IRCON",
    companyName: "IRCON International",
    exchange: "NSE",
    title: "Imposition of Liquidated Damages — Patna-Mughalsarai Project",
    body:
      "Liquidated damages of INR 18.6 crores have been levied by East Central Railway on the Company for time over-run on the Patna-Mughalsarai third line project. The Company is contesting the imposition through arbitration.",
    severity: "warning",
    category: "regulatory",
    triggerWords: ["Penalty", "Liquidated Damages"],
    filedAt: "2026-05-13T17:25:00+05:30",
    predictedImpact: "low",
  },
  {
    id: "disc-bls-promoter-pledge",
    ticker: "BLS",
    companyName: "BLS International Services",
    exchange: "BSE",
    title: "Disclosure of Promoter Share Pledge",
    body:
      "Pursuant to Regulation 31 of the SEBI (SAST) Regulations 2011, the promoter group has pledged an additional 1.45% of the Company's equity capital. Total promoter pledge now stands at 6.82% of total equity.",
    severity: "warning",
    category: "structural",
    triggerWords: ["Promoter Pledge", "SAST"],
    filedAt: "2026-05-12T14:33:00+05:30",
    predictedImpact: "medium",
  },
];

export const disclosuresByTicker = disclosures.reduce<Record<string, Disclosure[]>>((acc, d) => {
  if (!acc[d.ticker]) acc[d.ticker] = [];
  acc[d.ticker].push(d);
  return acc;
}, {});
