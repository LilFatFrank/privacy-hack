"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "./Modal";

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

export function AddFundsModal({
  isOpen,
  onClose,
  walletAddress,
}: AddFundsModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col items-center">
        <h2 className="text-2xl font-semibold text-[#121212] mb-6">
          Add Funds
        </h2>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-2xl mb-6">
          <QRCodeSVG
            value={walletAddress}
            size={200}
            bgColor="#FFFFFF"
            fgColor="#121212"
          />
        </div>

        {/* Address */}
        <button
          onClick={copied ? undefined : handleCopy}
          className={`flex items-center gap-2 px-4 py-2 rounded-full bg-[#121212]/5 transition-colors mb-3 max-w-full ${copied ? "pointer-events-none" : "hover:bg-[#121212]/10"}`}
        >
          <span className="text-[#121212] text-sm font-mono truncate">
            {walletAddress}
          </span>
          <Image
            src={copied ? "/assets/success-alt.svg" : "/assets/copy-icon.svg"}
            alt=""
            width={copied ? 16 : 16}
            height={copied ? 8 : 16}
            className="shrink-0"
          />
        </button>

        <p className="text-[#121212]/50 text-sm text-center">
          Send SOL or USDC to this address
        </p>
      </div>
    </Modal>
  );
}
