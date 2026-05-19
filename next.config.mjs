import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required by @opennextjs/cloudflare when next build runs outside of
  // `opennextjs-cloudflare build` (e.g. as a separate step in a CF Workers
  // Build pipeline). Produces .next/standalone which OpenNext bundles into
  // .open-next/worker.js.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
