import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { EncryptionService } from "privacycash/utils";
import { WasmFactory } from "@lightprotocol/hasher.rs";
import { LocalStorage } from "node-localstorage";
import path from "node:path";

// Import our sponsored deposit functions (no balance checks, with feePayer support)
import {
  sponsoredDepositSPL,
  sponsoredDepositSOL,
} from "../privacycash/sponsoredDeposit";

const storage = new LocalStorage(path.join(process.cwd(), "cache"));

export interface AtomicSponsoredDepositParams {
  connection: Connection;
  userKeypair: Keypair;
  sponsorKeypair: Keypair;
  mintAddress: PublicKey | string;
  amount?: number;
  baseUnits?: number;
  referrer?: string;
}

export interface AtomicSponsoredDepositResult {
  tx: string;
}

/**
 * Creates a transaction signer for atomic sponsorship.
 *
 * Since we now build the transaction with the sponsor as fee payer from the start,
 * we just need both parties to sign. No decompile/recompile needed.
 *
 * Security properties:
 * - Sponsor's fee payment is atomic with user's deposit
 * - User cannot get fee payment without completing deposit
 * - If transaction fails, sponsor's SOL is not consumed
 */
function createAtomicTransactionSigner(
  sponsorKeypair: Keypair,
  userKeypair: Keypair
) {
  return async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
    // Sign with sponsor (fee payer - already set as payerKey in transaction)
    tx.sign([sponsorKeypair]);

    // Sign with user (token owner / deposit authorizer)
    tx.sign([userKeypair]);

    return tx;
  };
}

/**
 * Performs an atomic sponsored SPL deposit.
 *
 * Security model:
 * - NO pre-funding needed - fully atomic
 * - Transaction fee: Paid atomically by sponsor - fully protected
 * - Deposit: Only happens if sponsor pays fee - fully protected
 *
 * The sponsor cannot lose the transaction fee without the deposit completing.
 * The user cannot receive the fee subsidy without depositing.
 */
export async function atomicSponsoredDeposit(
  params: AtomicSponsoredDepositParams
): Promise<AtomicSponsoredDepositResult> {
  const {
    connection,
    userKeypair,
    sponsorKeypair,
    mintAddress,
    amount,
    baseUnits,
    referrer,
  } = params;

  // Initialize encryption service with user's keypair
  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromWallet(userKeypair);

  const lightWasm = await WasmFactory.getInstance();

  // Use our sponsored deposit function - no pre-funding, sponsor pays directly
  const result = await sponsoredDepositSPL({
    lightWasm,
    storage,
    keyBasePath: path.join(
      process.cwd(),
      "node_modules",
      "privacycash",
      "circuit2",
      "transaction2"
    ),
    publicKey: userKeypair.publicKey,
    connection,
    base_units: baseUnits,
    amount,
    encryptionService,
    transactionSigner: createAtomicTransactionSigner(sponsorKeypair, userKeypair),
    referrer,
    mintAddress,
    signer: userKeypair.publicKey,
    feePayer: sponsorKeypair.publicKey, // Sponsor pays the fee
  });

  return {
    tx: result.tx,
  };
}

/**
 * Performs an atomic sponsored SOL deposit.
 *
 * Security model:
 * - NO pre-funding needed - fully atomic
 * - Transaction fee: Paid atomically by sponsor - fully protected
 * - Deposit: Only happens if sponsor pays fee - fully protected
 */
export async function atomicSponsoredSolDeposit(params: {
  connection: Connection;
  userKeypair: Keypair;
  sponsorKeypair: Keypair;
  lamports: number;
  referrer?: string;
}): Promise<AtomicSponsoredDepositResult> {
  const { connection, userKeypair, sponsorKeypair, lamports, referrer } = params;

  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromWallet(userKeypair);

  const lightWasm = await WasmFactory.getInstance();

  // Use our sponsored deposit function - no pre-funding, sponsor pays directly
  const result = await sponsoredDepositSOL({
    lightWasm,
    storage,
    keyBasePath: path.join(
      process.cwd(),
      "node_modules",
      "privacycash",
      "circuit2",
      "transaction2"
    ),
    publicKey: userKeypair.publicKey,
    connection,
    amount_in_lamports: lamports,
    encryptionService,
    transactionSigner: createAtomicTransactionSigner(sponsorKeypair, userKeypair),
    referrer,
    signer: userKeypair.publicKey,
    feePayer: sponsorKeypair.publicKey, // Sponsor pays the fee
  });

  return {
    tx: result.tx,
  };
}

/**
 * Checks if a user needs sponsorship for a deposit.
 * Returns the amount of SOL needed for gas, or 0 if no sponsorship needed.
 *
 * Note: With our new sponsored deposit functions, the user never needs SOL for gas.
 * This function is kept for compatibility but will typically return 0 for SPL deposits
 * since only the deposit amount matters, not gas.
 */
export async function checkSponsorshipNeeded(
  connection: Connection,
  userPublicKey: PublicKey,
  minSolRequired: number = 0
): Promise<number> {
  if (minSolRequired === 0) {
    return 0; // No SOL needed when sponsor pays gas
  }

  const balance = await connection.getBalance(userPublicKey);
  const balanceInSol = balance / LAMPORTS_PER_SOL;

  if (balanceInSol >= minSolRequired) {
    return 0;
  }

  return minSolRequired - balanceInSol;
}
