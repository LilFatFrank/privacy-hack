"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { PublicKey } from "@solana/web3.js";
import { Modal } from "./Modal";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (address: string) => void;
}

export function QRScanner({ isOpen, onClose, onScan }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>("qr-reader-" + Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const scannerId = containerRef.current;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (!mounted) return;

            // Strip solana: prefix if present
            const text = decodedText.replace(/^solana:/, "");

            try {
              new PublicKey(text);
              scanner.stop().catch(() => {});
              onScan(text);
              onClose();
            } catch {
              setError("Not a valid Solana wallet address");
              setTimeout(() => setError(null), 2000);
            }
          },
          () => {} // ignore scan failures (no QR detected yet)
        );
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to start camera");
        }
      }
    };

    // Small delay to ensure DOM element exists
    const timeout = setTimeout(startScanner, 100);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScan, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-2xl font-semibold text-[#121212]">Scan QR Code</h2>
      </div>

      <div
        id={containerRef.current}
        className="w-full rounded-2xl overflow-hidden bg-[#121212]/5"
        style={{ minHeight: 280 }}
      />

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-500 text-sm text-center mt-3"
        >
          {error}
        </motion.p>
      )}

      <motion.button
        onClick={onClose}
        whileTap={{ scale: 0.98 }}
        className="w-full h-10 mt-4 bg-[#121212] rounded-full flex items-center justify-center text-[#fafafa] font-semibold shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
      >
        Cancel
      </motion.button>
    </Modal>
  );
}
