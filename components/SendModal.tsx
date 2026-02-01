"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { PublicKey } from "@solana/web3.js";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { formatNumber } from "@/utils";
import { useSendTransaction } from "@/hooks/useSendTransaction";

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  onSendViaClaim: () => void;
  signature: string | null;
  senderPublicKey: string | null;
}

type ModalState = "input" | "loading" | "success" | "error";

// Partner fee: ~0.71 USDC + 0.35% of amount
const BASE_FEE = 0.71;
const FEE_PERCENT = 0.0035; // 0.35%

export function SendModal({
  isOpen,
  onClose,
  amount,
  onSendViaClaim,
  signature,
  senderPublicKey,
}: SendModalProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [state, setState] = useState<ModalState>("input");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { send } = useSendTransaction();

  const numAmount = parseFloat(amount) || 0;
  const partnerFee = BASE_FEE + numAmount * FEE_PERCENT;
  const total = numAmount - partnerFee;

  const isValidAddress = useMemo(() => {
    if (!walletAddress) return false;
    try {
      new PublicKey(walletAddress);
      return true;
    } catch {
      return false;
    }
  }, [walletAddress]);

  const handleProceed = async () => {
    if (!isValidAddress || !signature || !senderPublicKey) return;

    setState("loading");
    setErrorMessage(null);

    try {
      await send({
        receiverAddress: walletAddress,
        amount: numAmount,
        token: "USDC",
        signature,
        senderPublicKey,
      });
      setState("success");
    } catch (error: any) {
      console.error("Send failed:", error);
      setErrorMessage(error.message || "Transaction failed");
      setState("error");
    }
  };

  const handleClose = () => {
    setState("input");
    setWalletAddress("");
    setErrorMessage(null);
    onClose();
  };

  const handleRetry = () => {
    setState("input");
    setErrorMessage(null);
  };

  const formatAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Image src="/assets/send.svg" alt="Send" width={24} height={24} className="invert" />
        <h2 className="text-2xl font-semibold text-[#121212]">Send</h2>
      </div>

      <AnimatePresence mode="wait">
        {state === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Wallet Address Input */}
            <div className="mb-6">
              <label className="text-sm text-[#121212]/50 mb-1 block">
                Enter wallet address
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder=""
                className="w-full h-12 px-4 rounded-full border border-[#121212]/10 bg-transparent text-[#121212] outline-none focus:border-[#121212]/30 transition-colors"
              />
            </div>

            {/* Amount Details */}
            <div className="space-y-2 mb-8">
              <div className="flex justify-between">
                <span className="text-[#121212]">Amount</span>
                <span className="text-[#121212]">{formatNumber(numAmount)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212]">Partner Fees</span>
                <span className="text-[#121212]">~{formatNumber(partnerFee)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212] font-semibold">They Receive</span>
                <span className="text-[#121212] font-semibold">~{formatNumber(total)} USDC</span>
              </div>
            </div>

            {/* Proceed Button */}
            <motion.button
              onClick={handleProceed}
              disabled={!isValidAddress}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
            >
              Proceed
            </motion.button>

            {/* Generate Claim Link */}
            <button
              onClick={() => {
                handleClose();
                onSendViaClaim();
              }}
              className="w-full mt-4 text-[#121212]/70 text-sm underline underline-offset-4 decoration-dashed hover:text-[#121212] transition-colors"
            >
              Generate a claim link
            </button>
          </motion.div>
        )}

        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Spinner size={48} color="#121212" />
            <p className="mt-4 text-[#121212]/70">Processing transaction...</p>
          </motion.div>
        )}

        {state === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Success Details */}
            <div className="space-y-2 mb-8">
              <div className="flex justify-between">
                <span className="text-[#121212]">Sent To</span>
                <span className="text-[#121212]">{formatAddress(walletAddress)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212]">Amount</span>
                <span className="text-[#121212]">{formatNumber(numAmount)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212]">Partner Fees</span>
                <span className="text-[#121212]">~{formatNumber(partnerFee)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212] font-semibold">They Receive</span>
                <span className="text-[#121212] font-semibold">~{formatNumber(total)} USDC</span>
              </div>
            </div>

            {/* Success Button */}
            <motion.button
              onClick={handleClose}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 bg-[#fafafa] border border-[#121212]/70 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
            >
              <Image src="/assets/success-alt.svg" alt="Success" width={24} height={24} />
            </motion.button>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <span className="text-red-500 text-2xl">!</span>
            </div>
            <p className="text-[#121212] font-medium mb-2">Transaction Failed</p>
            <p className="text-[#121212]/60 text-sm text-center mb-6">
              {errorMessage || "Something went wrong"}
            </p>
            <motion.button
              onClick={handleRetry}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
            >
              Try Again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
