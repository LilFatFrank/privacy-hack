import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["privacycash"],
  serverExternalPackages: [
    "privacycash",
    "@lightprotocol/hasher.rs",
  ],
};

export default nextConfig;
