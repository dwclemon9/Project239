import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; it must stay outside the server bundle.
  serverExternalPackages: ['better-sqlite3'],

  // Lets the launcher build into a staging directory and swap it in only once
  // the build succeeds. A failed `next build` empties its output directory, so
  // building straight into `.next` would destroy a working dashboard.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
