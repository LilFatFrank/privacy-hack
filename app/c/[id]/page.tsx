"use client";

import { useEffect, useState, use } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { formatNumber } from "@/utils";
import { Spinner, ClaimPassphraseModal } from "@/components";

interface ClaimData {
  id: string;
  amount: number;
  token: string;
  status: string;
  message: string | null;
  createdAt: string;
}

type PageState = "loading" | "ready" | "success" | "error" | "not_found" | "already_claimed";

// Partner fee: ~0.71 USDC + 0.35% of amount
const BASE_FEE = 0.71;
const FEE_PERCENT = 0.0035;

export default function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [claimData, setClaimData] = useState<ClaimData | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);

  const solanaWallet = wallets[0];

  useEffect(() => {
    async function fetchClaimData() {
      try {
        const res = await fetch(`/api/send_claim/${id}`);

        if (res.status === 404) {
          setPageState("not_found");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to fetch claim data");
        }

        const data: ClaimData = await res.json();
        setClaimData(data);

        if (data.status === "settled" || data.status === "cancelled") {
          setPageState("already_claimed");
        } else {
          setPageState("ready");
        }
      } catch (error) {
        console.error("Error fetching claim:", error);
        setPageState("error");
      }
    }

    fetchClaimData();
  }, [id]);

  const handleClaim = () => {
    if (!authenticated) {
      login();
      return;
    }
    setShowPassphraseModal(true);
  };

  const handleClaimSuccess = () => {
    setPageState("success");
  };

  const formatAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (pageState === "loading") {
    return (
      <main className="flex flex-col items-center justify-center p-4 w-full min-h-[60vh]">
        <Spinner size={48} color="#121212" />
        <p className="mt-4 text-[#121212]/70">Loading claim...</p>
      </main>
    );
  }

  if (pageState === "not_found") {
    return (
      <main className="flex flex-col items-center justify-center p-4 w-full min-h-[60vh]">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <span className="text-red-500 text-2xl">!</span>
        </div>
        <p className="text-[#121212] font-medium">Claim link not found</p>
        <p className="text-[#121212]/60 text-sm mt-2">This link may be invalid or expired.</p>
      </main>
    );
  }

  if (pageState === "error") {
    return (
      <main className="flex flex-col items-center justify-center p-4 w-full min-h-[60vh]">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <span className="text-red-500 text-2xl">!</span>
        </div>
        <p className="text-[#121212] font-medium">Something went wrong</p>
        <p className="text-[#121212]/60 text-sm mt-2">Please try again later.</p>
      </main>
    );
  }

  if (pageState === "already_claimed") {
    return (
      <main className="flex flex-col items-center justify-center p-4 w-full min-h-[60vh]">
        <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
          <span className="text-yellow-600 text-2xl">!</span>
        </div>
        <p className="text-[#121212] font-medium">Already claimed</p>
        <p className="text-[#121212]/60 text-sm mt-2">This claim link has already been used.</p>
      </main>
    );
  }

  if (!claimData) return null;

  const partnerFee = BASE_FEE + claimData.amount * FEE_PERCENT;
  const youReceive = claimData.amount - partnerFee;

  return (
    <>
      <main className="flex flex-col items-center p-4 w-full">
        {/* Amount Display */}
        <div className="flex flex-col items-center mb-8 w-full max-w-full">
          <div className="w-full max-w-[320px] overflow-x-auto scrollbar-hide">
            <p className="text-6xl font-light text-[#121212] text-center">
              {formatNumber(claimData.amount)}
            </p>
          </div>
          {claimData.message && (
            <p className="mt-2 text-[#121212]/50 text-sm italic">
              {claimData.message}
            </p>
          )}
        </div>

        {/* Details */}
        <div className="w-full max-w-[320px] space-y-2 mb-8">
          <div className="flex justify-between">
            <span className="text-[#121212]">Sent by</span>
            <span className="text-[#121212]">{formatAddress(id)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#121212]">Partner fees</span>
            <span className="text-[#121212]">{formatNumber(partnerFee)} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#121212]">You receive</span>
            <span className="text-[#121212]">{formatNumber(youReceive)} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#121212] font-semibold">Total</span>
            <span className="text-[#121212] font-semibold">{formatNumber(claimData.amount)} USDC</span>
          </div>
        </div>

        {/* Claim Button */}
        {pageState === "ready" && (
          <motion.button
            onClick={handleClaim}
            whileTap={{ scale: 0.98 }}
            className="w-full max-w-[320px] h-12 bg-[#121212] rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
          >
            <Image src="/assets/receive.svg" alt="Claim" width={24} height={24} />
          </motion.button>
        )}

        {/* Success State */}
        {pageState === "success" && (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-[320px] h-12 bg-[#fafafa] border border-[#121212]/70 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
          >
            <Image src="/assets/success-alt.svg" alt="Success" width={24} height={24} />
          </motion.button>
        )}
      </main>

      {/* Passphrase Modal */}
      {showPassphraseModal && claimData && solanaWallet && (
        <ClaimPassphraseModal
          isOpen={showPassphraseModal}
          onClose={() => setShowPassphraseModal(false)}
          amount={claimData.amount}
          activityId={claimData.id}
          receiverAddress={solanaWallet.address}
          onSuccess={handleClaimSuccess}
        />
      )}
    </>
  );
}
