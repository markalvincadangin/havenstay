/** @type {import('next').NextConfig} */
const backendOrigin =
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig = {
  output: "standalone",
  turbopack: {},
  allowedDevOrigins: ["localhost", "127.0.0.1", "book-street-maggot.ngrok-free.dev"],
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
