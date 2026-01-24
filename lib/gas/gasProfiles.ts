export type TxProfile = "DEPOSIT_SPL" | "WITHDRAW_SPL" | "CLAIM_LINK";

export const GAS_PROFILES: Record<TxProfile, number> = {
  DEPOSIT_SPL: 0.0025 * 1e9,

  WITHDRAW_SPL: 0.003 * 1e9,

  CLAIM_LINK: 0.0055 * 1e9,
};
