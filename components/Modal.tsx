"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Modal - Desktop: center, Mobile: bottom sheet */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed z-50 bg-[#fafafa] rounded-t-3xl md:rounded-3xl w-full max-w-[430px] bottom-0 left-1/2 -translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2"
          >
            {/* Drag handle for mobile */}
            <div className="flex justify-center pt-3 pb-2 md:hidden">
              <div className="w-10 h-1 bg-[#121212]/20 rounded-full" />
            </div>

            <div className="px-6 pb-8 pt-4 md:pt-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
