#!/usr/bin/env node
/**
 * Runs the production build automatically when pnpm install runs inside
 * Cloudflare Workers Builds (or any CI).
 *
 * Why this exists:
 *   CF Workers Builds pipeline is just `pnpm install` -> `npx wrangler deploy`.
 *   When wrangler sees an OpenNext project it delegates straight to
 *   `opennextjs-cloudflare deploy` without running a build first, so the
 *   bundle at .open-next/.build/open-next.config.edge.mjs is missing and
 *   deploy fails.
 *
 *   We piggy-back on the install lifecycle: postinstall runs the build, so
 *   when wrangler deploy starts the bundle is already on disk.
 *
 * Skipped locally so `pnpm install` stays fast on dev machines. Force-run
 * with FORCE_CF_BUILD=1, skip on CI with SKIP_CF_BUILD=1.
 */
import { execSync } from "node:child_process";

const env = process.env;
const isCI =
  env.FORCE_CF_BUILD === "1" ||
  env.CI === "true" ||
  env.CI === "1" ||
  !!env.CF_PAGES ||
  !!env.WORKERS_CI ||
  !!env.CLOUDFLARE_WORKERS_BUILDS ||
  process.cwd().startsWith("/opt/buildhome");

if (env.SKIP_CF_BUILD === "1") {
  console.log("[cf-postinstall] SKIP_CF_BUILD=1 — skipping build.");
  process.exit(0);
}

if (!isCI) {
  console.log("[cf-postinstall] Local install — skipping build. Run `pnpm run build` manually when needed.");
  process.exit(0);
}

console.log("[cf-postinstall] CI / Cloudflare Workers Builds detected — running production build so wrangler deploy can find .open-next/.");
try {
  execSync("pnpm run build", { stdio: "inherit" });
} catch (err) {
  console.error("[cf-postinstall] build failed:", err.message);
  process.exit(1);
}
