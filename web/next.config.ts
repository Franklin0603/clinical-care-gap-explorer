import type { NextConfig } from "next";

// GitHub Pages serves a project site under /<repo>, so assets need that prefix.
// Set by the deploy workflow; empty for local dev and for any host serving at root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static export (Decision D9): every page renders at build time from the JSON
  // snapshot in public/data. No server runtime, so this deploys anywhere.
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
