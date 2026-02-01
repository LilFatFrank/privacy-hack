"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { formatNumber } from "@/utils";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
}

type ModalState = "input" | "loading" | "success";

// Partner fee: ~0.71 USDC + 0.35% of amount
const BASE_FEE = 0.71;
const FEE_PERCENT = 0.0035; // 0.35%

export function ReceiveModal({ isOpen, onClose, amount }: ReceiveModalProps) {
  const [message, setMessage] = useState("");
  const [state, setState] = useState<ModalState>("input");
  const [requestLink, setRequestLink] = useState("");

  const numAmount = parseFloat(amount) || 0;
  const partnerFee = BASE_FEE + numAmount * FEE_PERCENT;
  const youReceive = numAmount - partnerFee;

  const handleProceed = async () => {
    setState("loading");

    try {
      // TODO: Call request API
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulated delay
      setRequestLink(`${window.location.origin}/request/abc123`);
      setState("success");
    } catch (error) {
      console.error("Request failed:", error);
      setState("input");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(requestLink);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleClose = () => {
    setState("input");
    setMessage("");
    setRequestLink("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Image src="/assets/receive.svg" alt="Request" width={24} height={24} className="invert" />
        <h2 className="text-2xl font-semibold text-[#121212]">Request</h2>
      </div>

      <AnimatePresence mode="wait">
        {state === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Message Input */}
            <div className="mb-6">
              <label className="text-sm text-[#121212]/50 mb-2 block">
                Add message (optional)
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder=""
                className="w-full h-12 px-4 rounded-full border border-[#121212]/10 bg-transparent text-[#121212] outline-none focus:border-[#121212]/30 transition-colors"
              />
            </div>

            {/* Amount Details */}
            <div className="space-y-3 mb-8">
              <div className="flex justify-between">
                <span className="text-[#121212]">Amount</span>
                <span className="text-[#121212]">{formatNumber(numAmount)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212]">Partner Fees</span>
                <span className="text-[#121212]">~{formatNumber(partnerFee)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212] font-semibold">You Receive</span>
                <span className="text-[#121212] font-semibold">~{formatNumber(youReceive)} USDC</span>
              </div>
            </div>

            {/* Proceed Button */}
            <motion.button
              onClick={handleProceed}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold transition-opacity shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
            >
              Proceed
            </motion.button>
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
            <p className="mt-4 text-[#121212]/70">Generating request link...</p>
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
            <div className="space-y-3 mb-8">
              <div className="flex justify-between">
                <span className="text-[#121212]">Amount</span>
                <span className="text-[#121212]">{formatNumber(numAmount)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212]">Partner Fees</span>
                <span className="text-[#121212]">~{formatNumber(partnerFee)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#121212] font-semibold">You Receive</span>
                <span className="text-[#121212] font-semibold">~{formatNumber(youReceive)} USDC</span>
              </div>
            </div>

            {/* Copy Link Button */}
            <motion.button
              onClick={handleCopyLink}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center gap-2 text-[#fafafa] font-semibold shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
            >
              <motion.svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
              >
                <path
                  d="M5 12L10 17L19 8"
                  stroke="#fafafa"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
              Copy Request Link
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
