/**
 * IREPS probe v2 — find which IREPS pages are reachable without the
 * mobile-OTP auth wall.
 *
 * Probe v1 found: the homepage is open, but anonymSearch.do (tender
 * search) demands mobile-number + SMS-OTP authentication. IREPS links are
 * all javascript: calls, so the real URLs live in its JS files.
 *
 * This probe: fetches the homepage, pulls every <script src>, scans the JS
 * for ".do" endpoints, then GETs each candidate and reports whether it's
 * open, captcha-gated, or OTP-walled. The goal is the public transparency
 * pages — "High Value Tenders" and "Banned / Suspended Firms" — which
 * govt sites usually leave open.
 *
 * Output: data/ireps-probe.json (committed to the data branch). Temporary.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const HOME = "https://www.ireps.gov.in/";
const ORIGIN = "https://www.ireps.gov.in";

const HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function abs(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return ORIGIN + href;
  return `${ORIGIN}/${href.replace(/^\.?\//, "")}`;
}

interface EndpointResult {
  url: string;
  status: number | null;
  bytes: number;
  /** Page is gated behind the mobile-OTP / "authenticate yourself" wall. */
  otpWalled: boolean;
  hasCaptcha: boolean;
  tableCount: number;
  trCount: number;
  textSample: string;
  error?: string;
}

async function fetchText(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  return { status: res.status, body: await res.text() };
}

async function probeEndpoint(url: string): Promise<EndpointResult> {
  const r: EndpointResult = {
    url,
    status: null,
    bytes: 0,
    otpWalled: false,
    hasCaptcha: false,
    tableCount: 0,
    trCount: 0,
    textSample: "",
  };
  try {
    const { status, body } = await fetchText(url);
    r.status = status;
    r.bytes = body.length;
    r.hasCaptcha = /captcha/i.test(body);
    r.otpWalled =
      /authenticate yourself/i.test(body) ||
      /enter\b[^<]{0,40}\bOTP/i.test(body) ||
      /session has expired/i.test(body);
    const $ = cheerio.load(body);
    r.tableCount = $("table").length;
    r.trCount = $("tr").length;
    r.textSample = body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

async function main() {
  console.log("Fetching IREPS homepage + JS...");
  const home = await fetchText(HOME);
  const $ = cheerio.load(home.body);

  // Collect <script src> URLs (same-origin only).
  const scriptSrcs: string[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !/^https?:\/\/(?!www\.ireps)/i.test(src)) scriptSrcs.push(abs(src));
  });
  console.log(`  ${scriptSrcs.length} same-origin script(s) found`);

  // Concatenate the JS and scan for ".do" endpoints.
  let js = "";
  for (const src of scriptSrcs.slice(0, 20)) {
    try {
      const { body } = await fetchText(src);
      js += "\n" + body;
    } catch {
      /* skip */
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const doEndpoints = [
    ...new Set([...js.matchAll(/['"`]([\w./-]+\.do)\b/g)].map((m) => m[1])),
  ];
  console.log(`  ${doEndpoints.length} distinct .do endpoint(s) referenced in JS`);

  // Prioritise the transparency-page candidates.
  const interesting = doEndpoints.filter((e) =>
    /high.?value|tender|search|award|bann|debar|nit/i.test(e),
  );
  const toProbe = [...new Set([...interesting, ...doEndpoints])].slice(0, 16);

  const results: EndpointResult[] = [];
  for (const ep of toProbe) {
    const r = await probeEndpoint(abs(ep));
    results.push(r);
    console.log(
      `  ${ep.padEnd(34)} status=${r.status ?? "ERR"} bytes=${r.bytes} ` +
        `otpWall=${r.otpWalled} captcha=${r.hasCaptcha} tables=${r.tableCount}`,
    );
    await new Promise((r) => setTimeout(r, 500));
  }

  await mkdir("data", { recursive: true });
  await writeFile(
    path.resolve("data", "ireps-probe.json"),
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        scriptCount: scriptSrcs.length,
        doEndpointsFound: doEndpoints,
        results,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const open = results.filter((r) => r.status === 200 && !r.otpWalled && !r.hasCaptcha && r.trCount > 5);
  console.log(
    open.length
      ? `\nOpen, data-bearing endpoints: ${open.map((r) => r.url).join(", ")}`
      : "\nNo open data-bearing IREPS endpoint found among candidates.",
  );
}

main().catch((err) => {
  console.error("probe-ireps failed:", err);
  process.exit(1);
});
