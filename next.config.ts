import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["geoip-lite", "sharp", "nodemailer"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
  async headers() {
    return [
      { source: "/api/v1/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
};

export default nextConfig;
