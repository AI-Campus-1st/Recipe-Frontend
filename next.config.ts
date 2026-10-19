import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev indicator overlaps the bottom navigation in the mobile-sized frame.
  devIndicators: false,
};

export default nextConfig;
