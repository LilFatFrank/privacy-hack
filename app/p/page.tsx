"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { formatNumber } from "@/utils";
import { Spinner } from "@/components";
import { useSessionSignature } from "@/hooks/useSessionSignature";

interface Activity {
  id: string;
  type: "send" | "request" | "send_claim";
  status: "open" | "settled" | "cancelled";
  amount: number;
  token_address: string;
  message: string | null;
  created_at: string;
  sender_address: string | null;
  receiver_address: string | null;
}

interface Stats {
  total_sent: number;
  total_received: number;
  total_claimed: number;
}

interface UserData {
  activities: Activity[];
  stats: Stats;
}

// Status colors
const STATUS_COLORS = {
  open: "#CB9C00",
  settled: "#008834",
  cancelled: "#CB0000",
};

export default function ProfilePage() {
  const { login, logout, authenticated } = usePrivy();
  const { address } = useSessionSignature();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);

  useEffect(() => {
    async function fetchUserData() {
      if (!address) return;

      setIsLoading(true);
      try {
        const res = await fetch(`/api/activity/user?address=${address}`);
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (authenticated && address) {
      fetchUserData();
    }
  }, [authenticated, address]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays <= 7) return `${diffDays}d ago`;

    // After 7 days, show date like "21 Mar"
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const getActivityLabel = (activity: Activity) => {
    switch (activity.type) {
      case "send":
        return `Sent ${formatNumber(activity.amount)} USDC`;
      case "send_claim":
        return `Sent ${formatNumber(activity.amount)} USDC via Claim`;
      case "request":
        // Check if user is the requester or the payer
        if (activity.receiver_address?.toLowerCase() === address?.toLowerCase()) {
          return `Requested ${formatNumber(activity.amount)} USDC`;
        }
        return `Fulfilled ${formatNumber(activity.amount)} USDC`;
      default:
        return `${formatNumber(activity.amount)} USDC`;
    }
  };

  const getActivityIcon = (activity: Activity) => {
    // Send and send_claim show up arrow, request shows down arrow for requester
    if (activity.type === "send" || activity.type === "send_claim") {
      return "/assets/send.svg";
    }
    if (activity.type === "request") {
      if (activity.receiver_address?.toLowerCase() === address?.toLowerCase()) {
        return "/assets/receive.svg";
      }
      return "/assets/send.svg";
    }
    return "/assets/send.svg";
  };

  const getActivityLink = (activity: Activity): string | null => {
    // Only link open request and claim activities
    if (activity.status !== "open") return null;

    if (activity.type === "request") {
      return `/r/${activity.id}`;
    }
    if (activity.type === "send_claim") {
      return `/c/${activity.id}`;
    }
    return null;
  };

  const ActivityItem = ({ activity }: { activity: Activity }) => {
    const link = getActivityLink(activity);
    const content = (
      <>
        <Image
          src={getActivityIcon(activity)}
          alt=""
          width={20}
          height={20}
          className="mt-0.5 invert"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[#121212] text-sm">
            {getActivityLabel(activity)}
          </p>
          <p
            className="text-xs font-normal uppercase"
            style={{ color: STATUS_COLORS[activity.status] }}
          >
            {activity.status}
          </p>
        </div>
        <span className="text-[#121212]/50 text-xs whitespace-nowrap">
          {formatTimeAgo(activity.created_at)}
        </span>
      </>
    );

    if (link) {
      return (
        <Link
          href={link}
          className="flex items-start gap-3 hover:bg-[#121212]/5 -mx-2 px-2 py-1 rounded-lg transition-colors"
        >
          {content}
        </Link>
      );
    }

    return <div className="flex items-start gap-3">{content}</div>;
  };

  // Not connected state
  if (!authenticated) {
    return (
      <main className="flex flex-col items-center justify-center p-4 w-full min-h-[60vh]">
        <motion.button
          onClick={login}
          whileTap={{ scale: 0.98 }}
          className="px-8 h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
        >
          Connect Wallet
        </motion.button>
        <div className="mt-2 flex items-center gap-2 text-[#121212]/50 text-sm">
          <span>Powered by</span>
          <Image
            src="/assets/privacy-cash-logo.svg"
            alt="Privacy Cash"
            width={20}
            height={20}
          />
        </div>
      </main>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <main className="flex flex-col items-center justify-center p-4 w-full min-h-[60vh]">
        <Spinner size={48} color="#121212" />
        <p className="mt-4 text-[#121212]/70">Loading profile...</p>
      </main>
    );
  }

  const recentActivities = userData?.activities?.slice(0, 3) || [];
  const allActivities = userData?.activities || [];

  return (
    <>
      <main className="flex flex-col items-center p-4 w-full">
        {/* Wallet Section */}
        <div className="w-full max-w-[320px] mb-8">
          <h2 className="text-2xl font-medium text-[#121212] mb-4">Wallet</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[#121212]">Sends</span>
              <span className="text-[#121212]">
                {formatNumber(userData?.stats?.total_sent || 0)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#121212]">Requests</span>
              <span className="text-[#121212]">
                {formatNumber(userData?.stats?.total_received || 0)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#121212]">Sends via Claim</span>
              <span className="text-[#121212]">
                {formatNumber(userData?.stats?.total_claimed || 0)} USDC
              </span>
            </div>
          </div>
        </div>

        {/* Activity Section */}
        <div className="w-full max-w-[320px] mb-8">
          <h2 className="text-2xl font-medium text-[#121212] mb-4">Activity</h2>

          {recentActivities.length === 0 ? (
            <p className="text-[#121212]/50 text-sm">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {recentActivities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          )}

          {allActivities.length > 3 && (
            <button
              onClick={() => setShowAllActivities(true)}
              className="mt-3 text-[#121212]/70 text-sm underline underline-offset-4 decoration-dashed hover:text-[#121212] transition-colors"
            >
              View all
            </button>
          )}
        </div>

        {/* Disconnect Button */}
        <motion.button
          onClick={logout}
          whileTap={{ scale: 0.98 }}
          className="w-full max-w-[320px] h-10 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
        >
          Disconnect
        </motion.button>

        {/* Powered by */}
        <div className="mt-2 flex items-center gap-2 text-[#121212]/50 text-sm">
          <span>Powered by</span>
          <Image
            src="/assets/privacy-cash-logo.svg"
            alt="Privacy Cash"
            width={20}
            height={20}
          />
        </div>
      </main>

      {/* View All Modal */}
      <AnimatePresence>
        {showAllActivities && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllActivities(false)}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs"
            />

            {/* Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#fafafa] rounded-t-3xl h-[50vh] flex flex-col md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md md:rounded-3xl md:h-[60vh]"
            >
              {/* Handle bar (mobile) */}
              <div className="flex justify-center pt-3 md:hidden shrink-0">
                <div className="w-10 h-1 bg-[#121212]/20 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#121212]/10 shrink-0">
                <h3 className="text-lg font-semibold text-[#121212]">
                  All Activity
                </h3>
              </div>

              {/* Activity List */}
              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                <div className="space-y-4">
                  {allActivities.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
