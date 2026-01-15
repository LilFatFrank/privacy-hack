import { PublicKey } from "@solana/web3.js";

export const TOKEN_MINTS = {
  USDC: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  USDT: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
} as const;

export type TokenType = "SOL" | keyof typeof TOKEN_MINTS;
