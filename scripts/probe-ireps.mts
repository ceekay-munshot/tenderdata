/**
 * One-shot probe of IREPS (ireps.gov.in — Indian Railway e-procurement).
 *
 * IREPS is a CRIS-built system, structurally unlike NIC's CPPP, and its
 * URL layout is unknown. This probe fetches the homepage and a couple of
 * guessed tender endpoints, then reports — per URL — HTTP status, size,
 * captcha presence, table/row counts, every link (href + text), and every
 * form (action + method). The homepage's links reveal the real
 * tender-listing entry points to target next.
 *
 * Output: data/ireps-probe.json + data/ireps-probe.html (committed to the
 * data branch). Both temporary — removed once the IREPS source is chosen.
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

interface Candidate {
  name: string;
  url: string;
}

const CANDIDATES: Candidate[] = [
  { name: "home", url: "https://www.ireps.gov.in/" },
  { name: "home-nowww", url: "https://ireps.gov.in/" },
  // Best-effort guesses — IREPS commonly exposes anonymous tender search.
  { name: "guess-anon-search", url: "https://www.ireps.gov.in/epsn/anonymSearch.do" },
  { name: "guess-tender", url: "https://www.ireps.gov.in/epsn/" },
];

interface LinkInfo {
  text: string;
  href: string;
}

interface ProbeResult {
  name: string;
  url: string;
  status: number | null;
  finalUrl?: string;
  bytes: number;
  hasCaptcha: boolean;
  tableCount: number;
  trCount: number;
  formCount: number;
  forms: { action: string; method: string }[];
  /** Links whose text/href hints at tenders. */
  tenderLinks: LinkInfo[];
  /** First 60 links overall (to see the nav). */
  links: LinkInfo[];
  textSample: string;
  error?: string;
}

async function probe(c: Candidate): Promise<ProbeResult> {
  const base: ProbeResult = {
    name: c.name,
    url: c.url,
    status: null,
    bytes: 0,
    hasCaptcha: false,
    tableCount: 0,
    trCount: 0,
    formCount: 0,
    forms: [],
    tenderLinks: [],
    links: [],
    textSample: "",
  };
  try {
    const res = await fetch(c.url, { headers: HEADERS, redirect: "follow" });
    const html = await res.text();
    base.status = res.status;
    base.finalUrl = res.url;
    base.bytes = html.length;
    base.hasCaptcha = /captcha/i.test(html);

    const $ = cheerio.load(html);
    base.tableCount = $("table").length;
    base.trCount = $("tr").length;

    $("form").each((_, el) => {
      base.forms.push({
        action: $(el).attr("action") ?? "",
        method: ($(el).attr("method") ?? "GET").toUpperCase(),
      });
    });
    base.formCount = base.forms.length;

    const all: LinkInfo[] = [];
    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") ?? "").trim();
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (href && href !== "#" && !href.startsWith("javascript:void")) {
        all.push({ text, href });
      }
    });
    base.links = all.slice(0, 60);
    base.tenderLinks = all.filter((l) =>
      /tender|bid|e-?proc|works|goods|search|nit|auction|contract/i.test(`${l.text} ${l.href}`),
    );

    base.textSample = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
  }
  return base;
}

async function main() {
  console.log(`Probing ${CANDIDATES.length} IREPS endpoints...`);
  const results: ProbeResult[] = [];
  let homepageHtml = "";

  for (const c of CANDIDATES) {
    const r = await probe(c);
    results.push(r);
    console.log(
      `  ${r.name.padEnd(20)} status=${r.status ?? "ERR"} bytes=${r.bytes} ` +
        `captcha=${r.hasCaptcha} forms=${r.formCount} tenderLinks=${r.tenderLinks.length}` +
        `${r.error ? ` error=${r.error}` : ""}`,
    );
    if (r.name === "home" && r.status === 200) {
      // keep the homepage HTML for inspection
      try {
        const res = await fetch(c.url, { headers: HEADERS });
        homepageHtml = await res.text();
      } catch {
        /* ignore */
      }
    }
    await new Promise((res) => setTimeout(res, 800));
  }

  await mkdir("data", { recursive: true });
  await writeFile(
    path.resolve("data", "ireps-probe.json"),
    JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2) + "\n",
    "utf8",
  );
  if (homepageHtml) {
    const stripped = homepageHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    await writeFile(path.resolve("data", "ireps-probe.html"), stripped.slice(0, 250_000), "utf8");
  }
  console.log("\nWrote data/ireps-probe.json (+ ireps-probe.html if homepage loaded).");
}

main().catch((err) => {
  console.error("probe-ireps failed:", err);
  process.exit(1);
});
