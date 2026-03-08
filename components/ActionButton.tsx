"use client";

import { motion } from "motion/react";
import Image from "next/image";

interface ActionButtonProps {
  variant: "send" | "receive";
  onClick?: () => void;
  disabled?: boolean;
}

export function ActionButton({ variant, onClick, disabled }: ActionButtonProps) {
  const icon = variant === "send" ? "/assets/send.svg" : "/assets/receive.svg";
  const alt = variant === "send" ? "Send" : "Receive";

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={
        disabled
          ? {}
          : { scale: 1.03, transition: { type: "spring", damping: 20, stiffness: 400 } }
      }
      whileTap={
        disabled
          ? {}
          : { scale: 0.95, transition: { type: "spring", damping: 18, stiffness: 500 } }
      }
      className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
    >
      <Image src={icon} alt={alt} width={24} height={16} />
    </motion.button>
  );
}
