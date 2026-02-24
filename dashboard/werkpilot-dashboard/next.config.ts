import type { NextConfig } from "next";

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel-scripts.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https://*.googleusercontent.com https://*.githubusercontent.com https://*.gravatar.com https://*.wp.com https://images.unsplash.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://vercel.live https://*.vercel-analytics.com https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com;
  frame-src 'self' https://vercel.live;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  object-src 'none';
  upgrade-insecure-requests;
`.replace(/\n/g, " ").trim();

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy,
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
];

const nextConfig: NextConfig = {
  // ─── Core ───────────────────────────────────────────────
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,

  // ─── Experimental ──────────────────────────────────────
  experimental: {
    optimizeCss: true,
  },

  // ─── Images ────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.wp.com",
      },
    ],
  },

  // ─── Headers ───────────────────────────────────────────
  async headers() {
    return [
      // Security headers on all routes
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // API-specific headers
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },

  // ─── Turbopack ─────────────────────────────────────────
  turbopack: {},

  serverExternalPackages: [],
};

export default nextConfig;
