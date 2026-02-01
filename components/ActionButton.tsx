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
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-10 bg-[#121212] rounded-full flex items-center justify-center hover:bg-[#121212]/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(18,18,18,0.15)]"
    >
      <Image src={icon} alt={alt} width={24} height={16} />
    </button>
  );
}
