/**
 * IREPS probe v3 — dump the "View IREPS Documents" search form.
 *
 * irepsDocuments.do is the one IREPS tender endpoint NOT behind the
 * mobile-OTP wall ("View IREPS Documents - Indian Railways tenders for
 * Goods, Works and Services"). It's a search form. To build a scraper we
 * need its exact shape: the form action/method, every input + select
 * (with options), whether the submit needs a captcha, and whether the
 * Zone/Department dropdowns cascade.
 *
 * This probe GETs the IREPS homepage (for a JSESSIONID), then GETs the
 * documents page with that cookie, and reports the full form structure.
 *
 * Output: data/ireps-probe.json + data/ireps-doc-debug.html (committed to
 * the data branch). Temporary — removed once the scraper is built.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const HOME = "https://www.ireps.gov.in/";
const DOC_URL = "https://www.ireps.gov.in/epsn/works/irepsDocuments.do";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET with retries. IREPS is a flaky government server — it sometimes
 * closes the socket mid-response (UND_ERR_SOCKET). A few retries with
 * backoff usually catch a clean response.
 */
async function get(url: string, cookie?: string, referer?: string) {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const headers: Record<string, string> = { ...HEADERS };
      if (cookie) headers.Cookie = cookie;
      if (referer) headers.Referer = referer;
      const res = await fetch(url, { headers, redirect: "follow" });
      const body = await res.text();
      let nextCookie = cookie;
      const sc = res.headers.get("set-cookie");
      if (sc) {
        // Capture whatever session cookie IREPS sets (name varies).
        const m = sc.match(/([A-Za-z0-9_]+)=([^;]+)/);
        if (m) nextCookie = `${m[1]}=${m[2]}`;
      }
      return { status: res.status, body, cookie: nextCookie, finalUrl: res.url };
    } catch (err) {
      lastErr = err;
      console.log(`  attempt ${attempt}/5 failed: ${err instanceof Error ? err.message : err}`);
      await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

async function main() {
  console.log("GET homepage (for session cookie)...");
  const home = await get(HOME);
  console.log(`  homepage ${home.status}, cookie=${home.cookie ? "yes" : "no"}`);

  await sleep(1500);
  console.log("GET irepsDocuments.do with session...");
  const doc = await get(DOC_URL, home.cookie, HOME);
  console.log(`  irepsDocuments.do ${doc.status}, ${doc.body.length} bytes, finalUrl=${doc.finalUrl}`);

  const $ = cheerio.load(doc.body);

  // Form structure.
  const forms: {
    action: string;
    method: string;
    inputs: { name: string; type: string; value: string }[];
    selects: { name: string; options: { value: string; label: string }[] }[];
  }[] = [];

  $("form").each((_, f) => {
    const $f = $(f);
    const inputs: { name: string; type: string; value: string }[] = [];
    $f.find("input").each((_, el) => {
      const name = $(el).attr("name");
      if (name) inputs.push({ name, type: $(el).attr("type") ?? "text", value: $(el).attr("value") ?? "" });
    });
    const selects: { name: string; options: { value: string; label: string }[] }[] = [];
    $f.find("select").each((_, el) => {
      const name = $(el).attr("name");
      if (!name) return;
      const options: { value: string; label: string }[] = [];
      $(el)
        .find("option")
        .each((_, o) => {
          options.push({
            value: $(o).attr("value") ?? "",
            label: $(o).text().replace(/\s+/g, " ").trim(),
          });
        });
      selects.push({ name, options: options.slice(0, 40) });
    });
    forms.push({
      action: $f.attr("action") ?? "",
      method: ($f.attr("method") ?? "GET").toUpperCase(),
      inputs,
      selects,
    });
  });

  // Captcha signals.
  const captchaImg = $("img[src*='captcha' i], img[id*='captcha' i]").length;
  const captchaInput = $("input[name*='captcha' i], input[id*='captcha' i]").length;

  const report = {
    probedAt: new Date().toISOString(),
    docUrl: DOC_URL,
    status: doc.status,
    bytes: doc.body.length,
    captchaImageTags: captchaImg,
    captchaInputTags: captchaInput,
    formCount: forms.length,
    forms,
  };

  await mkdir("data", { recursive: true });
  await writeFile(
    path.resolve("data", "ireps-probe.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );

  const stripped = doc.body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  await writeFile(path.resolve("data", "ireps-doc-debug.html"), stripped.slice(0, 250_000), "utf8");

  console.log(
    `\nForms: ${forms.length}. Captcha img tags: ${captchaImg}, captcha input tags: ${captchaInput}.`,
  );
  for (const f of forms) {
    console.log(`  form action="${f.action}" method=${f.method} inputs=${f.inputs.length} selects=${f.selects.length}`);
    for (const s of f.selects) console.log(`    select ${s.name}: ${s.options.length} options`);
  }
  console.log("\nWrote data/ireps-probe.json + data/ireps-doc-debug.html");
}

main().catch(async (err) => {
  console.error("probe-ireps failed:", err);
  // Still write a report so the failure is visible on the data branch.
  try {
    await mkdir("data", { recursive: true });
    await writeFile(
      path.resolve("data", "ireps-probe.json"),
      JSON.stringify(
        { probedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  } catch {
    /* ignore */
  }
  process.exit(1);
});
