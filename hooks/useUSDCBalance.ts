"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

// USDC token mint on Solana mainnet
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Token program ID
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

interface UseUSDCBalanceResult {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useUSDCBalance(walletAddress: string | null): UseUSDCBalanceResult {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!walletAddress) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL! || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      const ownerPubkey = new PublicKey(walletAddress);

      // Get all token accounts for this wallet
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        ownerPubkey,
        { programId: TOKEN_PROGRAM_ID }
      );

      // Find USDC token account
      const usdcAccount = tokenAccounts.value.find(
        (account) => account.account.data.parsed.info.mint === USDC_MINT.toString()
      );

      if (usdcAccount) {
        const tokenAmount = usdcAccount.account.data.parsed.info.tokenAmount;
        // USDC has 6 decimals
        setBalance(tokenAmount.uiAmount || 0);
      } else {
        setBalance(0);
      }
    } catch (err: any) {
      console.error("Failed to fetch USDC balance:", err);
      setError(err.message || "Failed to fetch balance");
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [walletAddress]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance,
  };
}
