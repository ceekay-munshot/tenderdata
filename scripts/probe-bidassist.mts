/**
 * BidAssist bid-awards probe — inspect the tender-results page blob.
 *
 * The /api/tender/tenders endpoint ignores tenderEntity, and the dedicated
 * /api/bid-award/* paths 404. But BidAssist exposes a real results page at
 * /tender-results/all-tenders/active. Like the tenders page, it
 * server-renders a window.__INITIAL_STATE__ JSON blob — that's where the
 * award data lives.
 *
 * This probe fetches that page, extracts __INITIAL_STATE__, and reports
 * its top-level keys + a sample object from any embedded content[] array,
 * so the bid-awards scraper can be built against the real schema.
 *
 * Output: data/bidassist-probe.json. Temporary.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const PAGES = [
  "https://bidassist.com/tender-results/all-tenders/active",
  "https://bidassist.com/tender-results/active",
];

/** Balanced-brace extraction of window.__INITIAL_STATE__ = {...}. */
function extractInitialState(html: string): unknown | null {
  const idx = html.indexOf("window.__INITIAL_STATE__");
  if (idx === -1) return null;
  const start = html.indexOf("{", idx);
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\" && inStr) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function main() {
  const report: Record<string, unknown> = { probedAt: new Date().toISOString() };

  for (const url of PAGES) {
    const key = url.split("/").slice(3).join("/");
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
      const html = await res.text();
      console.log(`${url} -> ${res.status}, ${html.length} bytes`);

      const state = extractInitialState(html);
      if (!state || typeof state !== "object") {
        report[key] = { status: res.status, bytes: html.length, initialState: "not found" };
        continue;
      }

      const stateObj = state as Record<string, unknown>;
      const summary: Record<string, unknown> = { status: res.status, topLevelKeys: {} };
      const topKeys = summary.topLevelKeys as Record<string, unknown>;

      for (const [k, v] of Object.entries(stateObj)) {
        const t = Array.isArray(v) ? `array(${v.length})` : typeof v;
        topKeys[k] = t;
        // If this key holds a paginated object with content[], capture a sample.
        if (v && typeof v === "object" && Array.isArray((v as { content?: unknown[] }).content)) {
          const content = (v as { content: unknown[] }).content;
          summary[`${k}.contentLength`] = content.length;
          if (content[0] && typeof content[0] === "object") {
            summary[`${k}.sampleKeys`] = Object.keys(content[0] as object);
            summary[`${k}.sample`] = content[0];
          }
        }
      }
      report[key] = summary;
      console.log(`  __INITIAL_STATE__ keys: ${Object.keys(stateObj).join(", ")}`);
    } catch (err) {
      report[key] = { error: err instanceof Error ? err.message : String(err) };
      console.log(`  ERROR ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  await mkdir("data", { recursive: true });
  await writeFile(
    path.resolve("data", "bidassist-probe.json"),
    JSON.stringify(report, null, 2) + "\n",
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
