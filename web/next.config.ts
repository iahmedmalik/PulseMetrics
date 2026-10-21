import type { NextConfig } from "next";

// Where the API lives. The dashboard forwards /backend/* to it, so the sign-in cookie belongs to the
// dashboard's own address (browsers refuse to keep a cookie from another site).
const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ["@pulse/core"],
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
