import type { NextConfig } from "next";
import os from "os";

const nextConfig: NextConfig = {
  // node_modules/.pnpm is symlinked to ~/.cache/health_fun to keep the 1GB
  // package store out of iCloud Desktop sync, which evicts it. Turbopack
  // refuses any symlink that resolves outside its root, so the root has to
  // be an ancestor of both the project and that cache. It also silences the
  // "inferred workspace root" warning caused by the Anchor lockfile above.
  turbopack: { root: os.homedir() },
};

export default nextConfig;
