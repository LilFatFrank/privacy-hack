"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSignMessage, useWallets } from "@privy-io/react-auth/solana";
import { useCallback, useEffect, useState } from "react";

const SESSION_SIGNATURE_KEY = "session_signature";
const SESSION_ADDRESS_KEY = "session_address";
// Must match privacycash SDK's message for encryption key derivation
const SESSION_MESSAGE = "Privacy Money account sign in";

// Module-level flag to prevent multiple signature requests across hook instances
let signatureRequestPending = false;

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

  const [state, setState] = useState<SessionSignatureState>({
    signature: null,
    address: null,
    isLoading: true,
    needsSignature: false,
    error: null,
  });

  // Try to get wallet from useWallets first, fallback to user's linked wallet
  const solanaWallet = wallets[0];
  const userWalletAddress = user?.wallet?.address;

  // Debug logging
  useEffect(() => {
    console.log("[SessionSignature] ready:", ready, "authenticated:", authenticated, "wallets:", wallets.length, "solanaWallet:", solanaWallet?.address, "userWallet:", userWalletAddress);
  }, [ready, authenticated, wallets.length, solanaWallet?.address, userWalletAddress]);

  // Check for existing signature on mount and when wallet changes
  useEffect(() => {
    if (!ready) return;

    const storedSignature = sessionStorage.getItem(SESSION_SIGNATURE_KEY);
    const storedAddress = sessionStorage.getItem(SESSION_ADDRESS_KEY);

    // If we have a stored signature and it matches the current wallet
    if (storedSignature && storedAddress && solanaWallet?.address === storedAddress) {
      signatureRequestPending = false;
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
    if (authenticated && solanaWallet) {
      setState({
        signature: null,
        address: null,
        isLoading: false,
        needsSignature: true,
        error: null,
      });
      return;
    }

    // Not authenticated
    signatureRequestPending = false;
    setState({
      signature: null,
      address: null,
      isLoading: false,
      needsSignature: false,
      error: null,
    });
  }, [ready, authenticated, solanaWallet?.address]);

  // Request signature from user
  const requestSignature = useCallback(async () => {
    if (!solanaWallet) {
      setState((prev) => ({ ...prev, error: "No wallet connected" }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Encode message as Uint8Array
      const messageBytes = new TextEncoder().encode(SESSION_MESSAGE);

      // Request signature using Privy's Solana signMessage hook
      const { signature: signatureBytes } = await signMessage({
        message: messageBytes,
        wallet: solanaWallet,
      });

      // Convert signature to base64 for storage and API use
      const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));

      // Store in sessionStorage
      sessionStorage.setItem(SESSION_SIGNATURE_KEY, signatureBase64);
      sessionStorage.setItem(SESSION_ADDRESS_KEY, solanaWallet.address);

      signatureRequestPending = false;
      setState({
        signature: signatureBase64,
        address: solanaWallet.address,
        isLoading: false,
        needsSignature: false,
        error: null,
      });

      return true;
    } catch (error: any) {
      console.error("Failed to get signature:", error);
      signatureRequestPending = false;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Failed to sign message",
      }));
      return false;
    }
  }, [solanaWallet, signMessage]);

  // Auto-request signature when needed (only once across all hook instances)
  useEffect(() => {
    if (state.needsSignature && !state.isLoading && solanaWallet && !signatureRequestPending) {
      signatureRequestPending = true;
      requestSignature();
    }
  }, [state.needsSignature, state.isLoading, solanaWallet, requestSignature]);

  // Auto-clear signature on logout
  useEffect(() => {
    if (ready && !authenticated) {
      signatureRequestPending = false;
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
    walletAddress: solanaWallet?.address || userWalletAddress || null,
  };
}

// Export the message for backend verification
export const SESSION_MESSAGE_TEXT = SESSION_MESSAGE;
