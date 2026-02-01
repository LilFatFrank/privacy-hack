import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "privacycash",
    "@lightprotocol/hasher.rs",
  ],
};

export default nextConfig;
