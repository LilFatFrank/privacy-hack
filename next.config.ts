import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbo: false,
  serverExternalPackages: [
    "privacycash",
    "@lightprotocol/hasher.rs",
  ],
};

export default nextConfig;
