import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Inject build version at build time ────────────────────
  // This is the ONLY reliable way to get a unique deployment identifier
  // that works on Vercel, Render, and local dev. It's baked into both
  // client and server bundles at build time.
  env: {
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.RENDER_GIT_COMMIT ||
      process.env.COMMIT_REF ||
      Date.now().toString(),
  },

  // ── Security Headers ────────────────────────────────────────
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        },
      ],
    },
  ],
};

export default nextConfig;
