"use client";

import { useMemo } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

// Use placeholder during build if env var not set - Privy won't actually connect
// but hooks will have context and won't throw
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "placeholder-build-id";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Only create Solana connectors on client side to avoid SSR issues
  const solanaConnectors = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return toSolanaWalletConnectors({ shouldAutoConnect: true });
  }, []);

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          accentColor: "#6A6FF5",
          theme: "#FFFFFF",
          showWalletLoginFirst: true,
          logo: "/assets/logo.svg",
          walletChainType: "solana-only",
          walletList: [
            "detected_solana_wallets",
            "phantom",
            "solflare",
            "backpack",
          ],
        },
        loginMethods: ["wallet"],
        fundingMethodConfig: {
          moonpay: {
            useSandbox: true,
          },
        },
        embeddedWallets: {
          showWalletUIs: true,
          ethereum: {
            createOnLogin: "off",
          },
          solana: {
            createOnLogin: "off",
          },
        },
        mfa: {
          noPromptOnMfaRequired: false,
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        solana: {},
      }}
    >
      {children}
    </PrivyProvider>
  );
}
