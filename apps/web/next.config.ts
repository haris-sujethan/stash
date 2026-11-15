import type { NextConfig } from "next";

const config: NextConfig = {
  // The MongoDB driver stays a Node dependency rather than being bundled.
  serverExternalPackages: ["mongodb"],
  // No floating Next.js badge in development.
  devIndicators: false,
};

export default config;
