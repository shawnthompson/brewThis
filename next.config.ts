import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A production build must never write the .next of a running dev server —
  // that corrupts it (500 on every page). Build with NEXT_DIST_DIR=.next-build.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
