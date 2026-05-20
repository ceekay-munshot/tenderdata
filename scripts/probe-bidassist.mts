/**
 * BidAssist API probe — find the tender-listing/search endpoint.
 *
 * The server-rendered __INITIAL_STATE__ only carries page 0 (10 tenders);
 * ?pageNumber= is ignored on SSR. Real pagination/search runs client-side
 * against api.bidassist.com. Earlier guesses (/api/tender-listings/) 404'd
 * because the real path family — visible in the JS — is
 * /api/tender/tender-listings/ (note the extra /tender/).
 *
 * This probe hits the likely endpoints with GET and POST and reports which
 * returns JSON tender data. Output: data/bidassist-probe.json. Temporary.
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

const PATHS = [
  "/api/tender/tender-listings",
  "/api/tender/tender-listings/",
  "/api/tender/tender-listings/search",
  "/api/tender/tender-listings/v2",
  "/api/tender-listings",
  "/api/tender/tenders",
  "/api/tender/tenders/search",
  "/api/v1/tender/tender-listings",
];

/** Query params + POST body shape mirror the listing-page URL we saw. */
const QUERY = "?sort=RELEVANCE:DESC&pageNumber=0&pageSize=10&tenderEntity=TENDER";
const BODY = JSON.stringify({
  sort: "RELEVANCE:DESC",
  pageNumber: 0,
  pageSize: 10,
  tenderEntity: "TENDER",
});

interface Result {
  url: string;
  method: string;
  status: number | null;
  contentType: string;
  isJson: boolean;
  /** Looks like it carries tender rows. */
  hasTenders: boolean;
  bytes: number;
  sample: string;
  error?: string;
}

async function probe(url: string, method: "GET" | "POST"): Promise<Result> {
  const r: Result = {
    url,
    method,
    status: null,
    contentType: "",
    isJson: false,
    hasTenders: false,
    bytes: 0,
    sample: "",
  };
  try {
    const init: RequestInit = {
      method,
      headers: {
        ...HEADERS,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: BODY } : {}),
    };
    const res = await fetch(url, init);
    const body = await res.text();
    r.status = res.status;
    r.contentType = res.headers.get("content-type") ?? "";
    r.bytes = body.length;
    r.isJson = /json/i.test(r.contentType) || /^\s*[[{]/.test(body);
    r.hasTenders = /tenderDescription|tenderNoticeNo|"content"\s*:/i.test(body);
    r.sample = body.slice(0, 500);
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

async function main() {
  console.log("Probing BidAssist API endpoints...");
  const results: Result[] = [];
  for (const p of PATHS) {
    for (const method of ["GET", "POST"] as const) {
      const url = API + p + (method === "GET" ? QUERY : "");
      const r = await probe(url, method);
      results.push(r);
      console.log(
        `  ${method.padEnd(4)} ${p.padEnd(36)} -> ${r.status ?? "ERR"} ` +
          `${r.isJson ? "JSON" : r.contentType} tenders=${r.hasTenders}`,
      );
      await new Promise((res) => setTimeout(res, 400));
    }
  }

  await mkdir("data", { recursive: true });
  await writeFile(
    path.resolve("data", "bidassist-probe.json"),
    JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2) + "\n",
    "utf8",
  );

  const hit = results.find((r) => r.status === 200 && r.hasTenders);
  console.log(
    hit
      ? `\nFOUND tender API: ${hit.method} ${hit.url}`
      : "\nNo tender-bearing endpoint found — see data/bidassist-probe.json samples.",
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
