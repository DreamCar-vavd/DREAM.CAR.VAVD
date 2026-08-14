import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 90],
  },
  experimental: {
    globalNotFound: true,
  },
};

export default nextConfig;
