import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "127.0.0.1:3000",
    "localhost:3000",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10gb", // Large video file uploads
    },
  },
};

export default nextConfig;
