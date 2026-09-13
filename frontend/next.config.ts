import type { NextConfig } from "next";
import os from "os";

// Local only: node_modules/.pnpm is symlinked to ~/.cache/health_fun to keep
// the 1GB package store out of iCloud Desktop sync, which evicts it. Turbopack
// refuses symlinks outside its root, so locally the root is widened to cover
// the cache. On Vercel (or any CI) there is no symlink and the default root
// is correct; pointing it at the build container's home would be wrong.
const isHostedBuild = Boolean(process.env.VERCEL || process.env.CI);

const nextConfig: NextConfig = {
  turbopack: { root: isHostedBuild ? __dirname : os.homedir() },
};

export default nextConfig;
