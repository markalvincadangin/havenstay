/** @type {import('next').NextConfig} */
const backendOrigin =
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["localhost", "127.0.0.1", "book-street-maggot.ngrok-free.dev"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
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
