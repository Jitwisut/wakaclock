import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

// =============================================================================
// BUNDLE ANALYZER
// =============================================================================
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

const developmentScriptPolicy = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
const developmentConnectPolicy =
  process.env.NODE_ENV === 'development' ? ' http: ws: wss:' : '';

/**
 * Next's static App Router output contains inline bootstrap/RSC scripts, so a nonce-only
 * policy would force every public page to become dynamic. `unsafe-inline` is therefore
 * limited to scripts and styles while every remote origin remains explicitly bounded.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${developmentScriptPolicy} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${developmentConnectPolicy} https://api.atoaxis.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.posthog.com`,
  "worker-src 'self' blob:",
].join('; ');

// =============================================================================
// NEXT.JS CONFIGURATION
// =============================================================================
const nextConfig: NextConfig = {
  // ---------------------------------------------------------------------------
  // React & Compilation
  // ---------------------------------------------------------------------------
  reactStrictMode: true,
  poweredByHeader: false,

  // ---------------------------------------------------------------------------
  // TypeScript
  // ---------------------------------------------------------------------------
  typescript: {
    ignoreBuildErrors: false,
    // Storybook and test tooling use a separate dependency graph. Production
    // builds should type-check the shipped Next.js app only.
    tsconfigPath: 'tsconfig.build.json',
  },

  // The repository contains other lockfiles above this app. Keep Turbopack's
  // project boundary at this app's directory — the Netlify base directory /
  // Vercel root directory — instead of the parent `frontend` directory.
  turbopack: {
    root: process.cwd(),
  },

  // ---------------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------------
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'bundui-images.netlify.app',
      },
      {
        protocol: 'https',
        hostname: '**.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.picsum.photos',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // ---------------------------------------------------------------------------
  // Headers (Security)
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // ---------------------------------------------------------------------------
  // Experimental Features
  // ---------------------------------------------------------------------------
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'lodash-es',
      'date-fns',
      '@radix-ui/react-icons',
      'recharts',
    ],
  },

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default withBundleAnalyzer(nextConfig);
