/** @type {import('next').NextConfig} */
const backendPort = process.env.BE_PORT || process.env.BACKEND_PORT || 55222;
const backendUrl = (process.env.OPENWA_BACKEND_URL || `http://localhost:${backendPort}`).replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true
  },
  async rewrites() {
    return [
      {
        source: "/docs",
        destination: `${backendUrl}/docs`
      },
      {
        source: "/docs/json",
        destination: `${backendUrl}/docs/json`
      },
      {
        source: "/docs/:path*",
        destination: `${backendUrl}/docs/:path*`
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`
      },
      {
        source: "/version",
        destination: `${backendUrl}/version`
      }
    ];
  }
};

module.exports = nextConfig;
