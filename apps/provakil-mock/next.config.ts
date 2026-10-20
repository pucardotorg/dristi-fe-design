import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // The monorepo root, stated: a lockfile further up the disk must not be taken for it.
  turbopack: { root: path.join(__dirname, "../..") },
};

export default nextConfig;
