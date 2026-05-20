/**
 * Probe BidAssist (bidassist.com) — a tender aggregator.
 *
 * Aggregators have already de-walled the government portals (captcha/OTP)
 * and normalised everything into one feed. BidAssist is a modern SPA, so
 * the real data is behind a JSON API. This probe:
 *   1. fetches the homepage + a guessed tender-listing page,
 *   2. pulls the JS bundles and scans them for API endpoints
 *      (api.bidassist.com / *.do paths / /api/ paths / v1 routes),
 *   3. GETs the most tender-looking candidates and reports whether they
 *      return JSON, HTML, or a block page.
 *
 * Output: data/bidassist-probe.json (committed to the data branch).
 * Temporary — removed once the BidAssist source is wired up.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const PAGES = [
  { name: "home", url: "https://www.bidassist.com/" },
  { name: "tenders-listing", url: "https://www.bidassist.com/all-tenders" },
];

interface PageResult {
  name: string;
  url: string;
  status: number | null;
  finalUrl?: string;
  bytes: number;
  contentType: string;
  /** Looks like a client-rendered SPA shell (tiny HTML, a root div). */
  looksLikeSpa: boolean;
  scriptCount: number;
  error?: string;
}

interface EndpointResult {
  url: string;
  status: number | null;
  contentType: string;
  bytes: number;
  isJson: boolean;
  sample: string;
  error?: string;
}

async function fetchText(url: string) {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  return {
    status: res.status,
    body: await res.text(),
    finalUrl: res.url,
    contentType: res.headers.get("content-type") ?? "",
  };
}

function abs(href: string, origin: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("/")) return origin + href;
  return `${origin}/${href}`;
}

async function main() {
  const origin = "https://www.bidassist.com";
  const pages: PageResult[] = [];
  const scriptUrls = new Set<string>();

  for (const p of PAGES) {
    try {
      const r = await fetchText(p.url);
      const $ = cheerio.load(r.body);
      $("script[src]").each((_, el) => {
        const s = $(el).attr("src");
        if (s) scriptUrls.add(abs(s, origin));
      });
      pages.push({
        name: p.name,
        url: p.url,
        status: r.status,
        finalUrl: r.finalUrl,
        bytes: r.body.length,
        contentType: r.contentType,
        looksLikeSpa: r.body.length < 80_000 && /id=["']root["']|id=["']app["']|__next/.test(r.body),
        scriptCount: $("script[src]").length,
      });
      console.log(`  ${p.name.padEnd(18)} status=${r.status} bytes=${r.body.length} scripts=${$("script[src]").length}`);
    } catch (err) {
      pages.push({
        name: p.name,
        url: p.url,
        status: null,
        bytes: 0,
        contentType: "",
        looksLikeSpa: false,
        scriptCount: 0,
        error: err instanceof Error ? err.message : String(err),
      });
      console.log(`  ${p.name.padEnd(18)} ERROR ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  // Scan JS bundles for API endpoints.
  console.log(`Scanning ${scriptUrls.size} JS bundle(s) for API endpoints...`);
  const apiCandidates = new Set<string>();
  let scanned = 0;
  for (const src of [...scriptUrls].slice(0, 12)) {
    try {
      const js = await fetchText(src);
      scanned++;
      for (const m of js.body.matchAll(/["'`]([^"'`\s]*\/api\/[^"'`\s?]+)["'`]/g)) {
        if (m[1].length < 120) apiCandidates.add(m[1]);
      }
      for (const m of js.body.matchAll(/https?:\/\/[a-z0-9.-]*api[a-z0-9.-]*\.[a-z]{2,}[^"'`\s]{0,80}/gi)) {
        apiCandidates.add(m[0]);
      }
    } catch {
      /* skip */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`  scanned ${scanned} bundle(s), found ${apiCandidates.size} API candidate(s)`);

  // Probe the most tender-looking API candidates.
  const tenderApis = [...apiCandidates]
    .filter((u) => /tender|bid|search|listing/i.test(u))
    .slice(0, 8);
  const endpoints: EndpointResult[] = [];
  for (const cand of tenderApis) {
    const url = cand.startsWith("http") ? cand : abs(cand, origin);
    try {
      const r = await fetchText(url);
      const isJson = /json/i.test(r.contentType) || /^\s*[[{]/.test(r.body);
      endpoints.push({
        url,
        status: r.status,
        contentType: r.contentType,
        bytes: r.body.length,
        isJson,
        sample: r.body.slice(0, 400),
      });
      console.log(`  probe ${url} -> ${r.status} ${isJson ? "JSON" : r.contentType}`);
    } catch (err) {
      endpoints.push({
        url,
        status: null,
        contentType: "",
        bytes: 0,
        isJson: false,
        sample: "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  await mkdir("data", { recursive: true });
  await writeFile(
    path.resolve("data", "bidassist-probe.json"),
    JSON.stringify(
      { probedAt: new Date().toISOString(), pages, apiCandidates: [...apiCandidates], endpoints },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log("\nWrote data/bidassist-probe.json");
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
