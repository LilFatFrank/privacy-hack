/**
 * Check transaction size with sweep instruction added
 */
import "dotenv/config";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";

// Mock deposit instruction (similar size to real one)
function createMockDepositInstruction(
  signer: PublicKey,
  programId: PublicKey
): TransactionInstruction {
  // Real deposit instruction data is ~900 bytes based on previous tests
  // We hit 1656 base64 bytes before, let's work backwards
  const mockData = Buffer.alloc(900);

  return new TransactionInstruction({
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true },
      // Add typical accounts (these would be in ALT in real tx)
      { pubkey: PublicKey.default, isSigner: false, isWritable: true },
      { pubkey: PublicKey.default, isSigner: false, isWritable: true },
      { pubkey: PublicKey.default, isSigner: false, isWritable: false },
      { pubkey: PublicKey.default, isSigner: false, isWritable: false },
      { pubkey: PublicKey.default, isSigner: false, isWritable: true },
      { pubkey: PublicKey.default, isSigner: false, isWritable: true },
      { pubkey: PublicKey.default, isSigner: false, isWritable: true },
      { pubkey: PublicKey.default, isSigner: false, isWritable: false },
      { pubkey: PublicKey.default, isSigner: false, isWritable: false },
      { pubkey: PublicKey.default, isSigner: false, isWritable: false },
    ],
    programId,
    data: mockData,
  });
}

async function main() {
  const connection = new Connection(process.env.RPC_URL!, "confirmed");

  const user = Keypair.generate();
  const sponsor = Keypair.generate();
  const programId = new PublicKey("pr1vgNUrjFVoQqf2VHj1evdy4rZyksLCJwNS9PVsQpS");

  // Get ALT (same one SDK uses)
  const ALT_ADDRESS = new PublicKey("HEN49U2ySJ85Vc78qprSW9y6mFDhs1NczRxyppNHjofe");
  const lookupTableAccount = await connection.getAddressLookupTable(ALT_ADDRESS);

  if (!lookupTableAccount.value) {
    console.log("ALT not found");
    return;
  }

  console.log("ALT addresses:", lookupTableAccount.value.state.addresses.length);

  // Check if sponsor would be in ALT
  const sponsorInALT = lookupTableAccount.value.state.addresses.some(
    (addr) => addr.equals(sponsor.publicKey)
  );
  console.log("Sponsor in ALT:", sponsorInALT);

  const { blockhash } = await connection.getLatestBlockhash();

  // Scenario 1: Deposit only (like current SDK)
  const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 });
  const depositIx = createMockDepositInstruction(user.publicKey, programId);

  const msg1 = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions: [computeIx, depositIx],
  }).compileToV0Message([lookupTableAccount.value]);

  const tx1 = new VersionedTransaction(msg1);
  const size1 = tx1.serialize().length;
  console.log("\n--- Scenario 1: Deposit only ---");
  console.log("Transaction size:", size1, "bytes");
  console.log("Base64 size:", Buffer.from(tx1.serialize()).toString("base64").length, "bytes");
  console.log("Headroom:", 1644 - Buffer.from(tx1.serialize()).toString("base64").length, "bytes");

  // Scenario 2: Deposit + Sweep (user pays, sweeps to sponsor)
  const sweepIx = SystemProgram.transfer({
    fromPubkey: user.publicKey,
    toPubkey: sponsor.publicKey,
    lamports: 1_000_000, // sweep amount
  });

  const msg2 = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions: [computeIx, depositIx, sweepIx],
  }).compileToV0Message([lookupTableAccount.value]);

  const tx2 = new VersionedTransaction(msg2);
  const size2 = tx2.serialize().length;
  console.log("\n--- Scenario 2: Deposit + Sweep ---");
  console.log("Transaction size:", size2, "bytes");
  console.log("Base64 size:", Buffer.from(tx2.serialize()).toString("base64").length, "bytes");
  console.log("Headroom:", 1644 - Buffer.from(tx2.serialize()).toString("base64").length, "bytes");
  console.log("Added by sweep:", size2 - size1, "bytes");

  // Scenario 3: Sponsor pays + Deposit + Sweep
  const msg3 = new TransactionMessage({
    payerKey: sponsor.publicKey,  // Sponsor pays
    recentBlockhash: blockhash,
    instructions: [computeIx, depositIx, sweepIx],
  }).compileToV0Message([lookupTableAccount.value]);

  const tx3 = new VersionedTransaction(msg3);
  const size3 = tx3.serialize().length;
  console.log("\n--- Scenario 3: Sponsor pays + Deposit + Sweep ---");
  console.log("Transaction size:", size3, "bytes");
  console.log("Base64 size:", Buffer.from(tx3.serialize()).toString("base64").length, "bytes");
  console.log("Headroom:", 1644 - Buffer.from(tx3.serialize()).toString("base64").length, "bytes");
  console.log("Added vs Scenario 1:", size3 - size1, "bytes");
}

main().catch(console.error);
