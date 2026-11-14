import type { NextConfig } from "next";

const config: NextConfig = {
  // The MongoDB driver stays a Node dependency rather than being bundled.
  serverExternalPackages: ["mongodb"],
};

export default config;
