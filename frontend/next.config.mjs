/** @type {import('next').NextConfig} */
const backendOrigin =
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

// Support comma-separated tunnel URLs for port-forwarding dev (ngrok, cloudflare, etc.)
// Set ALLOWED_DEV_ORIGINS=your-tunnel.ngrok-free.app in .env.local — do NOT hardcode here.
const extraOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((o) => o.trim())
  : [];

const nextConfig = {
  output: "standalone",
  turbopack: {},
  allowedDevOrigins: ["localhost", "127.0.0.1", ...extraOrigins],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/reports/:path*",
        destination: "/admin/reports/:path*",
        permanent: true,
      },
      {
        source: "/audit-logs/:path*",
        destination: "/admin/audit-logs/:path*",
        permanent: true,
      },
      {
        source: "/users/:path*",
        destination: "/admin/users/:path*",
        permanent: true,
      },
    ];
  },
  // Fallback for webpack-based processes
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
