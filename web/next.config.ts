import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export (Decision D9): every page renders at build time from the JSON
  // snapshot in public/data. No server runtime, so this deploys anywhere.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
