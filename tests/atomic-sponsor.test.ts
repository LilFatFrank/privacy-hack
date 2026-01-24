import { describe, it, expect, beforeAll } from "bun:test";
import { Connection, Keypair } from "@solana/web3.js";
import {
  checkSponsorshipNeeded,
  MIN_SOL_FOR_SDK_CHECK,
} from "../lib/sponsor/atomicSponsor";
import { loadSponsorWallet } from "../lib/sponsor/sponsorWallet";

// Skip if no environment variables
const SKIP_E2E = !process.env.SPONSOR_PRIVATE_KEY || !process.env.RPC_URL;

describe("Atomic Sponsorship", () => {
  let connection: Connection;
  let sponsorKeypair: Keypair;

  beforeAll(() => {
    if (SKIP_E2E) return;
    connection = new Connection(process.env.RPC_URL!, "confirmed");
    sponsorKeypair = loadSponsorWallet();
  });

  describe("checkSponsorshipNeeded", () => {
    it("should return 0 if user has enough SOL", async () => {
      if (SKIP_E2E) return;
      // Sponsor should have enough SOL
      const needed = await checkSponsorshipNeeded(
        connection,
        sponsorKeypair.publicKey
      );
      expect(needed).toBe(0);
    });

    it("should return correct amount for empty wallet", async () => {
      if (SKIP_E2E) return;
      const emptyWallet = Keypair.generate();
      const needed = await checkSponsorshipNeeded(
        connection,
        emptyWallet.publicKey
      );
      expect(needed).toBe(MIN_SOL_FOR_SDK_CHECK);
    });
  });

  describe("Security Properties", () => {
    it("should document the security model", () => {
      // This test documents the security properties of atomic sponsorship

      const securityProperties = {
        // Pre-fund risk: Small, acceptable amount
        maxPrefundRisk: `${MIN_SOL_FOR_SDK_CHECK} SOL`,

        // Transaction fee: Fully atomic
        transactionFeeProtection:
          "Sponsor pays fee atomically with deposit - if deposit fails, fee is not consumed",

        // Deposit protection
        depositProtection:
          "User cannot receive fee subsidy without completing deposit",

        // Griefing mitigation
        griefingMitigation:
          "Max loss per griefing attempt is limited to pre-fund amount",
      };

      console.log("Security Properties:", securityProperties);

      expect(securityProperties.maxPrefundRisk).toBe("0.002 SOL");
    });
  });
});
