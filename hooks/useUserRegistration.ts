"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

export function useUserRegistration() {
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || !user || registeredRef.current) return;

    // For Twitter users, prefer the embedded wallet over external wallets
    const isTwitterUser = !!user.twitter;
    const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
    const wallet = isTwitterUser && embeddedWallet ? embeddedWallet : wallets[0];
    const walletAddress = wallet?.address || user?.wallet?.address;
    if (!walletAddress) return;

    // Determine connection type
    const connectionType = isTwitterUser ? "x" : "wallet";
    const twitterHandle = user.twitter?.username || null;

    registeredRef.current = true;

    fetch("/api/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        connectionType,
        twitterHandle,
        privyUserId: user.id,
      }),
    }).catch((err) => {
      console.error("User registration failed:", err);
      registeredRef.current = false;
    });
  }, [ready, authenticated, user, wallets]);

  // Reset on logout
  useEffect(() => {
    if (ready && !authenticated) {
      registeredRef.current = false;
    }
  }, [ready, authenticated]);
}
