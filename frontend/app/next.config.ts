import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

// =============================================================================
// BUNDLE ANALYZER
// =============================================================================
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

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
  },

  // The repository contains other lockfiles above this app. Keep Turbopack's
  // project boundary at the Netlify base directory instead of the parent
  // `frontend` directory.
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
