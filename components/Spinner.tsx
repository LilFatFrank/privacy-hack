"use client";

import { motion } from "motion/react";

interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 24, color = "#fafafa" }: SpinnerProps) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="3"
          strokeOpacity="0.3"
        />
        <path
          d="M12 2C6.48 2 2 6.48 2 12"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}
