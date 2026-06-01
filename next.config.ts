import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

// Content Security Policy — applied only in production. In dev, Next.js HMR
// needs inline eval and websocket on arbitrary paths; a strict CSP breaks it.
// We can tighten further (nonces, removing 'unsafe-inline' for scripts) when
// we revisit Next.js 16's nonce support.
const CSP = [
  "default-src 'self'",
  // Tailwind injects inline styles; Next.js inlines hydration scripts.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Permissive for client logos, file thumbnails, brand assets from any host
  "img-src 'self' data: https: blob:",
  // Supabase Realtime (wss), Frame.io API, Metricool API, Google OAuth
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.frame.io https://app.metricool.com https://accounts.google.com",
  // PDF preview uses iframe
  "frame-src 'self'",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
    ];

    const prodOnly = isProd
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: CSP },
        ]
      : [];

    return [
      {
        source: "/(.*)",
        headers: [...base, ...prodOnly],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
