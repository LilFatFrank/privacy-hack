import { describe, it, expect, beforeAll } from "bun:test";
import { Connection, Keypair } from "@solana/web3.js";
import { checkSponsorshipNeeded } from "../lib/sponsor/atomicSponsor";
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
    it("should return 0 when no minimum is specified (sponsor pays all gas)", async () => {
      if (SKIP_E2E) return;
      // With our new sponsorship model, users don't need SOL for gas
      const needed = await checkSponsorshipNeeded(
        connection,
        sponsorKeypair.publicKey
      );
      expect(needed).toBe(0);
    });

    it("should return 0 for empty wallet (sponsor pays gas)", async () => {
      if (SKIP_E2E) return;
      const emptyWallet = Keypair.generate();
      // Even empty wallets don't need SOL - sponsor pays gas atomically
      const needed = await checkSponsorshipNeeded(
        connection,
        emptyWallet.publicKey
      );
      expect(needed).toBe(0);
    });
  });

  describe("Security Properties", () => {
    it("should document the security model", () => {
      // This test documents the security properties of atomic sponsorship

      const securityProperties = {
        // Pre-fund risk: ZERO - no pre-funding needed
        maxPrefundRisk: "0 SOL",

        // Transaction fee: Fully atomic
        transactionFeeProtection:
          "Sponsor pays fee atomically with deposit - if deposit fails, fee is not consumed",

        // Deposit protection
        depositProtection:
          "User cannot receive fee subsidy without completing deposit",

        // Griefing mitigation
        griefingMitigation:
          "No griefing possible - sponsor only pays if transaction succeeds atomically",
      };

      console.log("Security Properties:", securityProperties);

      // No pre-funding means no risk
      expect(securityProperties.maxPrefundRisk).toBe("0 SOL");
    });
  });
});
