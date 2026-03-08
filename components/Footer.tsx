"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/",  icon: "/assets/home-icon.svg",    alt: "Home"    },
  { href: "/p", icon: "/assets/profile-icon.svg", alt: "Profile" },
];

export function Footer() {
  const pathname = usePathname();

  return (
    <nav className="flex justify-center pb-6">
      <div
        className="relative flex items-center gap-1 px-2 py-2 rounded-full"
        style={{
          background: "rgba(18, 18, 18, 0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 4px 12px rgba(18, 18, 18, 0.1)",
        }}
      >
        {tabs.map(({ href, icon, alt }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="relative py-1 px-2 rounded-full flex items-center justify-center"
            >
              {active && (
                <motion.div
                  layoutId="footer-pill"
                  className="absolute inset-0 rounded-full bg-[#121212]/10"
                  transition={{ type: "spring", damping: 28, stiffness: 350 }}
                />
              )}
              <motion.div
                animate={{ opacity: active ? 1 : 0.45 }}
                transition={{ duration: 0.18 }}
                className="relative z-10"
              >
                <Image src={icon} alt={alt} width={24} height={24} />
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
