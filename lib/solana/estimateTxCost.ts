import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export type FlowType =
  | "USDC_DEPOSIT"
  | "USDC_WITHDRAW"
  | "USDC_DEPOSIT_AND_WITHDRAW"
  | "CLAIM_LINK";

export function estimateTxCostLamports(flow: FlowType) {
  switch (flow) {
    case "USDC_DEPOSIT":
      return 0.0015 * LAMPORTS_PER_SOL;

    case "USDC_WITHDRAW":
      return 0.002 * LAMPORTS_PER_SOL;

    case "USDC_DEPOSIT_AND_WITHDRAW":
      return 0.003 * LAMPORTS_PER_SOL;

    case "CLAIM_LINK":
      return 0.0045 * LAMPORTS_PER_SOL;

    default:
      throw new Error("Unknown flow type");
  }
}
