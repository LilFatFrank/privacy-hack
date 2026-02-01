import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "privacycash",
    "@lightprotocol/hasher.rs",
  ],
};

export default nextConfig;
