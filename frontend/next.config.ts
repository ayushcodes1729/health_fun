import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root has its own lockfile for the Anchor workspace; without this
  // Next.js guesses the wrong root and warns on every build.
  turbopack: { root: __dirname },
};

export default nextConfig;
