"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function Providers({ children }: { children: React.ReactNode }) {
  // During build/prerender, return children without Privy if no app ID
  if (!privyAppId) {
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
