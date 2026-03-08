"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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

  const mobileVariants = {
    hidden:  { opacity: 0, y: "100%" },
    visible: { opacity: 1, y: 0,
               transition: { type: "spring" as const, damping: 28, stiffness: 320 } },
    exit:    { opacity: 0, y: "100%",
               transition: { duration: 0.22, ease: [0.7, 0, 0.84, 0] as const } },
  };

  const desktopVariants = {
    hidden:  { opacity: 0, scale: 0.93, y: -8 },
    visible: { opacity: 1, scale: 1, y: 0,
               transition: { type: "spring" as const, damping: 28, stiffness: 320 } },
    exit:    { opacity: 0, scale: 0.96, y: 6,
               transition: { duration: 0.16, ease: [0.7, 0, 0.84, 0] as const } },
  };

  const variants = isDesktop ? desktopVariants : mobileVariants;

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
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
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
