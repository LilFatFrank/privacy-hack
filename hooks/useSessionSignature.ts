"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSignMessage, useWallets } from "@privy-io/react-auth/solana";
import { useCallback, useEffect, useRef, useState } from "react";

const SESSION_SIGNATURE_KEY = "session_signature";
const SESSION_ADDRESS_KEY = "session_address";
// Must match privacycash SDK's message for encryption key derivation
const SESSION_MESSAGE = "Privacy Money account sign in";

interface SessionSignatureState {
  signature: string | null;
  address: string | null;
  isLoading: boolean;
  needsSignature: boolean;
  error: string | null;
}

export function useSessionSignature() {
  const { authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const signatureRequestedRef = useRef(false);

  const [state, setState] = useState<SessionSignatureState>({
    signature: null,
    address: null,
    isLoading: true,
    needsSignature: false,
    error: null,
  });

  // For Twitter users, ONLY use the embedded wallet — never fall back to external wallets (e.g. Phantom)
  const isTwitterUser = !!user?.twitter;
  const userWalletAddress = user?.wallet?.address;
  const embeddedWallet = wallets.find(
    (w) =>
      (w as any).walletClientType === "privy" ||
      (userWalletAddress && w.address === userWalletAddress)
  );
  const solanaWallet = isTwitterUser
    ? embeddedWallet || null
    : wallets[0] || null;

  // Stable reference to current wallet address
  const walletAddress = solanaWallet?.address || null;

  // Check for existing signature on mount and when wallet changes
  useEffect(() => {
    if (!ready) return;

    const storedSignature = sessionStorage.getItem(SESSION_SIGNATURE_KEY);
    const storedAddress = sessionStorage.getItem(SESSION_ADDRESS_KEY);

    // If we have a stored signature and it matches the current wallet
    if (storedSignature && storedAddress && walletAddress === storedAddress) {
      signatureRequestedRef.current = false;
      setState({
        signature: storedSignature,
        address: storedAddress,
        isLoading: false,
        needsSignature: false,
        error: null,
      });
      return;
    }

    // If authenticated but no valid signature, we need one
    if (authenticated && walletAddress) {
      setState({
        signature: null,
        address: null,
        isLoading: false,
        needsSignature: true,
        error: null,
      });
      return;
    }

    // Not authenticated or wallet not ready yet
    setState({
      signature: null,
      address: null,
      isLoading: !ready,
      needsSignature: false,
      error: null,
    });
  }, [ready, authenticated, walletAddress]);

  // Request signature from user — stabilized with walletAddress string dep
  const requestSignature = useCallback(async () => {
    // Find the wallet at call time to avoid stale closure
    const wallet = wallets.find((w) => w.address === walletAddress);
    if (!wallet) {
      setState((prev) => ({ ...prev, error: "No wallet connected" }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const messageBytes = new TextEncoder().encode(SESSION_MESSAGE);

      const { signature: signatureBytes } = await signMessage({
        message: messageBytes,
        wallet,
      });

      const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));

      sessionStorage.setItem(SESSION_SIGNATURE_KEY, signatureBase64);
      sessionStorage.setItem(SESSION_ADDRESS_KEY, wallet.address);

      signatureRequestedRef.current = false;
      setState({
        signature: signatureBase64,
        address: wallet.address,
        isLoading: false,
        needsSignature: false,
        error: null,
      });

      return true;
    } catch (error: any) {
      console.error("Failed to get signature:", error);
      signatureRequestedRef.current = false;
      setState({
        signature: null,
        address: null,
        isLoading: false,
        needsSignature: false, // Don't retry — prevents infinite loop
        error: error.message || "Failed to sign message",
      });
      return false;
    }
  }, [walletAddress, wallets, signMessage]);

  // Auto-request signature when needed (only once per wallet)
  useEffect(() => {
    if (
      state.needsSignature &&
      !state.isLoading &&
      walletAddress &&
      !signatureRequestedRef.current
    ) {
      signatureRequestedRef.current = true;
      requestSignature();
    }
  }, [state.needsSignature, state.isLoading, walletAddress, requestSignature]);

  // Auto-clear signature on logout
  useEffect(() => {
    if (ready && !authenticated) {
      signatureRequestedRef.current = false;
      sessionStorage.removeItem(SESSION_SIGNATURE_KEY);
      sessionStorage.removeItem(SESSION_ADDRESS_KEY);
      setState({
        signature: null,
        address: null,
        isLoading: false,
        needsSignature: false,
        error: null,
      });
    }
  }, [ready, authenticated]);

  // Clear signature (manual)
  const clearSignature = useCallback(() => {
    sessionStorage.removeItem(SESSION_SIGNATURE_KEY);
    sessionStorage.removeItem(SESSION_ADDRESS_KEY);
    setState({
      signature: null,
      address: null,
      isLoading: false,
      needsSignature: false,
      error: null,
    });
  }, []);

  // Helper to get headers for API calls
  const getAuthHeaders = useCallback(() => {
    if (!state.signature || !state.address) {
      return null;
    }
    return {
      "X-Session-Signature": state.signature,
      "X-Wallet-Address": state.address,
    };
  }, [state.signature, state.address]);

  return {
    ...state,
    requestSignature,
    clearSignature,
    getAuthHeaders,
    isAuthenticated: authenticated && !!state.signature,
    walletAddress: walletAddress || userWalletAddress || null,
  };
}

// Export the message for backend verification
export const SESSION_MESSAGE_TEXT = SESSION_MESSAGE;
