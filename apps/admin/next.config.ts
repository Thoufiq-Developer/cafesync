import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cafesync/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

