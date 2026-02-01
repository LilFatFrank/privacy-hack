"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import { motion } from "motion/react";
import { useSessionSignature } from "@/hooks/useSessionSignature";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { formatNumber } from "@/utils";
import {
  ActionButton,
  NumberPad,
  SendModal,
  ReceiveModal,
  SendClaimModal,
} from "@/components";

type ModalType = "send" | "receive" | "sendClaim" | null;

export default function Home() {
  const { login, authenticated, logout } = usePrivy();
  const { walletAddress, signature, address } = useSessionSignature();
  const { balance, isLoading: balanceLoading, refetch: refetchUSDCBalance } = useUSDCBalance(walletAddress);
  const [amount, setAmount] = useState("0");
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const numAmount = parseFloat(amount) || 0;
  const hasValidAmount = numAmount > 0;
  const exceedsBalance = balance !== null && numAmount > balance;

  const handleNumberPress = (num: string) => {
    if (amount === "0" && num !== ".") {
      setAmount(num);
    } else if (num === "." && amount.includes(".")) {
      return;
    } else {
      setAmount(amount + num);
    }
  };

  const handleBackspace = () => {
    if (amount.length === 1) {
      setAmount("0");
    } else {
      setAmount(amount.slice(0, -1));
    }
  };

  const handleActionClick = (action: "send" | "receive") => {
    if (!authenticated) {
      login();
      return;
    }

    if (!hasValidAmount) {
      return;
    }

    // For send actions, check if amount exceeds balance
    if (action === "send" && exceedsBalance) {
      return;
    }

    setActiveModal(action);
  };

  const closeModal = () => {
    refetchUSDCBalance();
    setActiveModal(null);
  };

  const getBalanceDisplay = () => {
    if (!authenticated) return "Connect Wallet";
    if (balanceLoading) return "Loading...";
    if (balance !== null) return `${formatNumber(balance)} USDC`;
    return "Connect Wallet";
  };

  return (
    <>
      <main className="flex flex-col items-center p-4 w-full">
        {/* Amount Display */}
        <div className="flex flex-col items-center mb-8 w-full max-w-full">
          <div className="w-full max-w-[320px] overflow-x-auto scrollbar-hide">
            <input
              type="text"
              value={amount}
              readOnly
              disabled
              className="w-full text-6xl font-light text-[#121212] bg-transparent border-none outline-none text-center cursor-default select-none caret-transparent"
            />
          </div>
          <button
            onClick={() => (!authenticated ? login() : logout())}
            className="mt-2 text-sm text-[#121212]/50 hover:text-[#121212]/70 transition-colors"
          >
            {getBalanceDisplay()}
          </button>
        </div>

        {/* Number Pad */}
        <div className="mb-8 w-full flex justify-center">
          <NumberPad
            onNumberPress={handleNumberPress}
            onBackspace={handleBackspace}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 w-full">
          <motion.div
            className="flex-1"
            animate={
              authenticated && (!hasValidAmount || exceedsBalance)
                ? { x: [0, -4, 4, -4, 4, 0] }
                : {}
            }
            transition={{ duration: 0.4 }}
            key={`send-${authenticated && (!hasValidAmount || exceedsBalance) ? "shake" : "idle"}`}
          >
            <ActionButton
              variant="send"
              onClick={() => handleActionClick("send")}
              disabled={authenticated && (!hasValidAmount || exceedsBalance)}
            />
          </motion.div>
          <motion.div
            className="flex-1"
            animate={
              authenticated && !hasValidAmount
                ? { x: [0, -4, 4, -4, 4, 0] }
                : {}
            }
            transition={{ duration: 0.4 }}
            key={`receive-${authenticated && !hasValidAmount ? "shake" : "idle"}`}
          >
            <ActionButton
              variant="receive"
              onClick={() => handleActionClick("receive")}
              disabled={authenticated && !hasValidAmount}
            />
          </motion.div>
        </div>
      </main>

      {/* Modals - only render when active to avoid multiple hook instances */}
      {activeModal === "send" && (
        <SendModal
          isOpen={true}
          onClose={closeModal}
          amount={amount}
          onSendViaClaim={() => setActiveModal("sendClaim")}
          signature={signature}
          senderPublicKey={address}
        />
      )}

      {activeModal === "receive" && (
        <ReceiveModal
          isOpen={true}
          onClose={closeModal}
          amount={amount}
        />
      )}

      {activeModal === "sendClaim" && (
        <SendClaimModal
          isOpen={true}
          onClose={closeModal}
          amount={amount}
        />
      )}
    </>
  );
}
