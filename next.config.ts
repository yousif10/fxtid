import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Native / WASM / filesystem-reading packages must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@resvg/resvg-js", "pdfkit", "svg-to-pdfkit", "sharp", "postgres"],
  // Serverless bundles (Vercel) only contain traced files. The card exporter reads
  // the bundled Inter fonts at runtime and pdfkit reads its AFM metrics.
  outputFileTracingIncludes: {
    "/api/cards/*/export": ["./public/fonts/**/*.ttf", "./node_modules/pdfkit/js/data/**/*"],
  },
  // The embedded dev database (PGlite, ~10 MB of WASM) is never used in deployed
  // functions - production refuses to start without DATABASE_URL.
  outputFileTracingExcludes: {
    "/*": ["./node_modules/@electric-sql/pglite/**/*", "./.data/**/*", "./storage/**/*", "./tests/**/*"],
  },
  experimental: {
    serverActions: {
      // Employee photo uploads (validated to 8 MB server-side).
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Verification must always reflect live status - never cache, never index, never leak the token via Referer.
        source: "/verify/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
  async rewrites() {
    // Card QR codes use an upper-case URL (compact QR alphanumeric mode).
    return [{ source: "/VERIFY/:token", destination: "/verify/:token" }];
  },
};

export default nextConfig;
