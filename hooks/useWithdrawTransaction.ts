"use client";

import { useCallback, useState } from "react";
import { useWallets } from "@privy-io/react-auth/solana";

interface WithdrawParams {
  receiverAddress: string;
  amount: number;
  signature: string;
  senderPublicKey: string;
}

interface UseWithdrawTransactionResult {
  withdraw: (params: WithdrawParams) => Promise<{ signature: string }>;
  isLoading: boolean;
  error: string | null;
}

export function useWithdrawTransaction(): UseWithdrawTransactionResult {
  const { wallets } = useWallets();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const solanaWallet = wallets[0];

  const withdraw = useCallback(
    async (params: WithdrawParams): Promise<{ signature: string }> => {
      if (!solanaWallet) {
        throw new Error("No wallet connected");
      }

      if (!params.signature || !params.senderPublicKey) {
        throw new Error("No session signature. Please reconnect wallet.");
      }

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Prepare — server builds tx with sponsor as fee payer, partial-signs
        const prepareRes = await fetch("/api/withdraw", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Signature": params.signature,
          },
          body: JSON.stringify({
            senderPublicKey: params.senderPublicKey,
            receiverAddress: params.receiverAddress,
            amount: params.amount,
          }),
        });

        if (!prepareRes.ok) {
          const errorData = await prepareRes.json();
          throw new Error(errorData.error || "Failed to prepare withdraw");
        }

        const { transaction, blockhash, lastValidBlockHeight } =
          await prepareRes.json();

        // Step 2: Client co-signs the partially signed tx
        const txBytes = Uint8Array.from(atob(transaction), (c) =>
          c.charCodeAt(0)
        );

        let signedResult;
        try {
          signedResult = await solanaWallet.signTransaction({
            transaction: txBytes,
          });
        } catch (signError: any) {
          throw new Error(signError.message || "Transaction signing rejected");
        }

        const signedTx = btoa(
          String.fromCharCode.apply(
            null,
            Array.from(signedResult.signedTransaction)
          )
        );

        // Step 3: Submit fully signed tx
        const submitRes = await fetch("/api/withdraw/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signedTransaction: signedTx,
            blockhash,
            lastValidBlockHeight,
          }),
        });

        if (!submitRes.ok) {
          const errorData = await submitRes.json();
          throw new Error(errorData.error || "Failed to submit withdraw");
        }

        return await submitRes.json();
      } catch (err: any) {
        const errorMessage = err.message || "Withdraw failed";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [solanaWallet]
  );

  return { withdraw, isLoading, error };
}
