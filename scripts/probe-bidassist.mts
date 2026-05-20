/**
 * BidAssist probe v2 — find the real tender data source.
 *
 * Probe v1 revealed: the API lives on a separate host, api.bidassist.com
 * (v1 wrongly hit www.bidassist.com/api/... -> HTML 404s), and the
 * listing pages are big server-rendered HTML — likely a Next.js app with
 * the data embedded in a __NEXT_DATA__ JSON blob.
 *
 * This probe checks both routes:
 *   1. GET (and POST) the api.bidassist.com tender endpoints — does the
 *      public tender search return JSON without auth?
 *   2. Fetch the tender listing page and detect/measure any embedded data
 *      blob (__NEXT_DATA__ / __NUXT__ / __INITIAL_STATE__); dump the HTML
 *      with external script bundles stripped but inline scripts kept.
 *
 * Output: data/bidassist-probe.json + data/bidassist-page-debug.html.
 * Temporary — removed once the scraper is built.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const API_CANDIDATES = [
  "https://api.bidassist.com/api/tender-listings/",
  "https://api.bidassist.com/tender-listings/",
  "https://api.bidassist.com/api/tender/tenders/most-viewed",
  "https://api.bidassist.com/api/bid-awards/v2/",
];

const TENDER_PAGES = [
  "https://bidassist.com/global-tenders/active",
  "https://bidassist.com/tenders",
];

interface ApiResult {
  url: string;
  method: string;
  status: number | null;
  contentType: string;
  isJson: boolean;
  bytes: number;
  sample: string;
  error?: string;
}

async function probeApi(url: string, method: "GET" | "POST"): Promise<ApiResult> {
  const r: ApiResult = { url, method, status: null, contentType: "", isJson: false, bytes: 0, sample: "" };
  try {
    const init: RequestInit = {
      method,
      headers: {
        ...HEADERS,
        Accept: "application/json",
        Origin: "https://bidassist.com",
        Referer: "https://bidassist.com/",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify({ page: 1, size: 20 }) } : {}),
    };
    const res = await fetch(url, init);
    const body = await res.text();
    r.status = res.status;
    r.contentType = res.headers.get("content-type") ?? "";
    r.bytes = body.length;
    r.isJson = /json/i.test(r.contentType) || /^\s*[[{]/.test(body);
    r.sample = body.slice(0, 600);
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

interface PageResult {
  url: string;
  status: number | null;
  finalUrl?: string;
  bytes: number;
  /** Embedded data blob, if any. */
  dataBlob: { kind: string; bytes: number } | null;
  error?: string;
}

async function probePage(url: string): Promise<{ result: PageResult; html: string }> {
  const result: PageResult = { url, status: null, bytes: 0, dataBlob: null };
  let html = "";
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
    html = await res.text();
    result.status = res.status;
    result.finalUrl = res.url;
    result.bytes = html.length;

    // Look for a server-embedded data blob.
    const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    const nuxt = html.match(/window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/);
    const initial = html.match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/);
    if (nextData) result.dataBlob = { kind: "__NEXT_DATA__", bytes: nextData[1].length };
    else if (nuxt) result.dataBlob = { kind: "__NUXT__", bytes: nuxt[1].length };
    else if (initial) result.dataBlob = { kind: "__INITIAL_STATE__", bytes: initial[1].length };
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return { result, html };
}

async function main() {
  console.log("Probing api.bidassist.com endpoints...");
  const apiResults: ApiResult[] = [];
  for (const url of API_CANDIDATES) {
    for (const method of ["GET", "POST"] as const) {
      const r = await probeApi(url, method);
      apiResults.push(r);
      console.log(`  ${method.padEnd(4)} ${url} -> ${r.status ?? "ERR"} ${r.isJson ? "JSON" : r.contentType}${r.error ? ` (${r.error})` : ""}`);
      await new Promise((res) => setTimeout(res, 400));
    }
  }

  console.log("\nProbing tender listing pages...");
  const pageResults: PageResult[] = [];
  let bestHtml = "";
  let bestName = "";
  for (const url of TENDER_PAGES) {
    const { result, html } = await probePage(url);
    pageResults.push(result);
    console.log(
      `  ${url} -> ${result.status ?? "ERR"} bytes=${result.bytes}` +
        ` dataBlob=${result.dataBlob ? `${result.dataBlob.kind} (${result.dataBlob.bytes}b)` : "none"}`,
    );
    if (result.status === 200 && html.length > bestHtml.length) {
      bestHtml = html;
      bestName = url;
    }
    await new Promise((res) => setTimeout(res, 600));
  }

  await mkdir("data", { recursive: true });
  await writeFile(
    path.resolve("data", "bidassist-probe.json"),
    JSON.stringify({ probedAt: new Date().toISOString(), apiResults, pageResults }, null, 2) + "\n",
    "utf8",
  );

  if (bestHtml) {
    // Keep inline scripts (a __NEXT_DATA__ blob lives in one); drop the
    // huge external bundles and styles.
    const stripped = bestHtml
      .replace(/<script[^>]*\bsrc=[^>]*><\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    await writeFile(path.resolve("data", "bidassist-page-debug.html"), stripped.slice(0, 600_000), "utf8");
    console.log(`\nDumped ${bestName} -> data/bidassist-page-debug.html (${stripped.length} chars)`);
  }
  console.log("Wrote data/bidassist-probe.json");
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
