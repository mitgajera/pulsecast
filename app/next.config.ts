import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@pulsecast/protocol", "@pulsecast/shared"],
};

export default nextConfig;
