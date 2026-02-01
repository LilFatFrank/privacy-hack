import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/assets/logo.svg"
      alt="Swish"
      width={48}
      height={24}
      className={className}
      priority
    />
  );
}
