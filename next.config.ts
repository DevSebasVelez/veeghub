import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Receipts and account statements read their fonts and logo from disk at
  // request time (lib/pdf); route handlers and server actions under /admin
  // render them.
  outputFileTracingIncludes: {
    "/admin/**": ["./lib/pdf/fonts/**/*", "./lib/pdf/assets/**/*"],
  },
  async headers() {
    return [
      {
        // The service worker must never be served stale, or a device keeps
        // running an old version that has no push listener.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
