"use client";

import { useEffect, useMemo, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only create Solana connectors on client side
  const solanaConnectors = useMemo(() => {
    if (!mounted) return undefined;
    return toSolanaWalletConnectors({ shouldAutoConnect: true });
  }, [mounted]);

  // During SSR/build, render children without Privy
  // This avoids Privy's app ID validation during static generation
  if (!mounted) {
    return <>{children}</>;
  }

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!privyAppId) {
    console.warn("NEXT_PUBLIC_PRIVY_APP_ID not set");
    return <>{children}</>;
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
