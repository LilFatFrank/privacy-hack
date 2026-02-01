"use client";

import { useEffect, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

// Create connectors once on client side only
const solanaConnectors =
  typeof window !== "undefined"
    ? toSolanaWalletConnectors({ shouldAutoConnect: true })
    : undefined;

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until mounted on client
  // This prevents hooks from being called without PrivyProvider context
  if (!mounted) {
    return null;
  }

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!privyAppId) {
    console.warn("NEXT_PUBLIC_PRIVY_APP_ID not set");
    return null;
  }

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
