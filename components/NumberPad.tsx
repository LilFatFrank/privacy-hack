import Image from "next/image";

interface NumberPadProps {
  onNumberPress: (num: string) => void;
  onBackspace: () => void;
}

export function NumberPad({ onNumberPress, onBackspace }: NumberPadProps) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];

  return (
    <div className="grid grid-cols-3 gap-y-2 gap-x-4 w-full">
      {keys.map((num) => (
        <button
          key={num}
          onClick={() => onNumberPress(num)}
          className="h-14 text-2xl font-medium text-[#121212] hover:bg-[#121212]/5 active:bg-[#121212]/10 rounded-xl transition-colors"
        >
          {num}
        </button>
      ))}
      <button
        onClick={onBackspace}
        className="h-14 flex items-center justify-center hover:bg-[#121212]/5 active:bg-[#121212]/10 rounded-xl transition-colors"
      >
        <Image
          src="/assets/delete.svg"
          alt="Delete"
          width={28}
          height={19}
        />
      </button>
    </div>
  );
}
