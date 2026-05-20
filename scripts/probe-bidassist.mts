/**
 * BidAssist bid-awards API probe.
 *
 * The tender listing API turned out to be /api/tender/tenders with
 * tenderEntity=TENDER. Bid awards ("tender results" — who won) should
 * follow a similar shape. This probe tries the likely endpoints + entity
 * values and reports which returns award data (a winner / awarded-to /
 * bidAward field).
 *
 * Output: data/bidassist-probe.json. Temporary — removed once the
 * bid-awards scraper is built.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const API = "https://api.bidassist.com";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://bidassist.com",
  Referer: "https://bidassist.com/",
};

const QS = "sort=RELEVANCE:DESC&pageNumber=0&pageSize=10";

// Endpoint + entity combinations to try.
const CANDIDATES: string[] = [
  `${API}/api/tender/tenders?${QS}&tenderEntity=BID_AWARD`,
  `${API}/api/tender/tenders?${QS}&tenderEntity=BIDAWARD`,
  `${API}/api/tender/tenders?${QS}&tenderEntity=TENDER_RESULT`,
  `${API}/api/tender/tenders?${QS}&tenderEntity=RESULT`,
  `${API}/api/tender/tenders?${QS}&tenderEntity=BID_AWARDS`,
  `${API}/api/bid-award/bid-awards?${QS}`,
  `${API}/api/bid-award/bid-awards?${QS}&tenderEntity=BID_AWARD`,
  `${API}/api/tender/bid-awards?${QS}`,
  `${API}/api/bidaward/bidawards?${QS}`,
  `${API}/api/bid-awards/v2?${QS}`,
  `${API}/api/tender/tenders/bid-awards?${QS}`,
  `${API}/api/bid-award/tenders?${QS}`,
];

interface Result {
  url: string;
  status: number | null;
  contentType: string;
  isJson: boolean;
  /** Response carries a content[] array. */
  hasContent: boolean;
  /** Response mentions award / winner / bidder fields. */
  looksLikeAwards: boolean;
  bytes: number;
  sample: string;
  error?: string;
}

async function probe(url: string): Promise<Result> {
  const r: Result = {
    url,
    status: null,
    contentType: "",
    isJson: false,
    hasContent: false,
    looksLikeAwards: false,
    bytes: 0,
    sample: "",
  };
  try {
    const res = await fetch(url, { headers: HEADERS });
    const body = await res.text();
    r.status = res.status;
    r.contentType = res.headers.get("content-type") ?? "";
    r.bytes = body.length;
    r.isJson = /json/i.test(r.contentType) || /^\s*[[{]/.test(body);
    r.hasContent = /"content"\s*:/.test(body);
    r.looksLikeAwards =
      /bidAward|awardedTo|awardValue|"winner|winnerName|bidderName|resultStage|workOrder/i.test(body);
    r.sample = body.slice(0, 500);
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

async function main() {
  console.log("Probing BidAssist bid-awards endpoints...");
  const results: Result[] = [];
  for (const url of CANDIDATES) {
    const r = await probe(url);
    results.push(r);
    const tag = url.replace(`${API}/api/`, "").slice(0, 48);
    console.log(
      `  ${tag.padEnd(50)} -> ${r.status ?? "ERR"} ` +
        `${r.isJson ? "JSON" : r.contentType} content=${r.hasContent} awards=${r.looksLikeAwards}`,
    );
    await new Promise((res) => setTimeout(res, 400));
  }

  await mkdir("data", { recursive: true });
  await writeFile(
    path.resolve("data", "bidassist-probe.json"),
    JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2) + "\n",
    "utf8",
  );

  const hit = results.find((r) => r.status === 200 && r.hasContent && r.looksLikeAwards);
  console.log(
    hit
      ? `\nFOUND bid-awards API: ${hit.url}`
      : "\nNo award-bearing endpoint confirmed — inspect data/bidassist-probe.json samples.",
  );
}

main().catch(async (err) => {
  console.error("probe-bidassist failed:", err);
  try {
    await mkdir("data", { recursive: true });
    await writeFile(
      path.resolve("data", "bidassist-probe.json"),
      JSON.stringify({ probedAt: new Date().toISOString(), error: String(err) }, null, 2) + "\n",
    );
  } catch {
    /* ignore */
  }
  process.exit(1);
});
