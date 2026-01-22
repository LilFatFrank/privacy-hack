import { GAS_PROFILES } from "./gasProfiles";
import { GAS_BUFFER_MULTIPLIER } from "./constants";

export function estimateGasLamports(profile: keyof typeof GAS_PROFILES) {
  const base = GAS_PROFILES[profile];
  return Math.ceil(base * GAS_BUFFER_MULTIPLIER);
}
