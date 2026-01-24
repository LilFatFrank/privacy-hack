import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  SystemProgram,
  Transaction,
  AddressLookupTableAccount,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { depositSPL, deposit, EncryptionService } from "privacycash/utils";
import { WasmFactory } from "@lightprotocol/hasher.rs";
import { LocalStorage } from "node-localstorage";
import path from "node:path";

const storage = new LocalStorage(path.join(process.cwd(), "cache"));

// Minimum SOL required by SDK for fee buffer
const MIN_SOL_FOR_SDK_CHECK = 0.002;
const MIN_LAMPORTS_FOR_SDK_CHECK = MIN_SOL_FOR_SDK_CHECK * LAMPORTS_PER_SOL;

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
  prefundTx?: string;
}

/**
 * Creates a transaction signer that makes the sponsor the fee payer.
 *
 * This is the core of atomic sponsorship - the sponsor pays the transaction fee,
 * but the user must also sign to authorize the deposit. If either party doesn't
 * sign, the transaction cannot be submitted.
 *
 * Security properties:
 * - Sponsor's fee payment is atomic with user's deposit
 * - User cannot get fee payment without completing deposit
 * - If transaction fails, sponsor's SOL is not consumed
 */
function createAtomicTransactionSigner(
  connection: Connection,
  sponsorKeypair: Keypair,
  userKeypair: Keypair
) {
  return async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
    // Get the lookup tables used in the original transaction
    const lookupTableAccounts = await getLookupTableAccounts(
      connection,
      tx.message.addressTableLookups
    );

    // Decompile the original message to get instructions
    const decompiledMessage = TransactionMessage.decompile(tx.message, {
      addressLookupTableAccounts: lookupTableAccounts,
    });

    // Rebuild the message with sponsor as fee payer
    const newMessage = new TransactionMessage({
      payerKey: sponsorKeypair.publicKey,
      recentBlockhash: decompiledMessage.recentBlockhash,
      instructions: decompiledMessage.instructions,
    }).compileToV0Message(lookupTableAccounts);

    // Create new transaction and sign with both parties
    const newTx = new VersionedTransaction(newMessage);

    // Sign with sponsor (fee payer)
    newTx.sign([sponsorKeypair]);

    // Sign with user (token owner / deposit authorizer)
    newTx.sign([userKeypair]);

    return newTx;
  };
}

/**
 * Pre-funds a wallet with the minimum SOL needed to pass SDK checks.
 *
 * This is necessary because the SDK checks balances before building the transaction.
 * The pre-fund amount is small (max 0.002 SOL) and is the only part not protected
 * by atomicity.
 *
 * For burner wallets we control, this is safe.
 * For external users, this represents a small acceptable risk.
 */
async function ensureMinimumBalance(
  connection: Connection,
  sponsorKeypair: Keypair,
  targetPublicKey: PublicKey
): Promise<string | undefined> {
  const balance = await connection.getBalance(targetPublicKey);

  if (balance >= MIN_LAMPORTS_FOR_SDK_CHECK) {
    return undefined;
  }

  const needed = MIN_LAMPORTS_FOR_SDK_CHECK - balance;
  console.log(
    `Pre-funding ${needed / LAMPORTS_PER_SOL} SOL to ${targetPublicKey.toBase58().slice(0, 8)}...`
  );

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sponsorKeypair.publicKey,
      toPubkey: targetPublicKey,
      lamports: needed,
    })
  );

  const signature = await connection.sendTransaction(tx, [sponsorKeypair]);
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

/**
 * Performs an atomic sponsored SPL deposit.
 *
 * Security model:
 * - Pre-fund (if needed): Max 0.002 SOL at risk - small, acceptable
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

  // Ensure user has minimum balance for SDK check
  const prefundTx = await ensureMinimumBalance(
    connection,
    sponsorKeypair,
    userKeypair.publicKey
  );

  // Initialize encryption service with user's keypair
  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromWallet(userKeypair);

  const lightWasm = await WasmFactory.getInstance();

  const result = await depositSPL({
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
    transactionSigner: createAtomicTransactionSigner(
      connection,
      sponsorKeypair,
      userKeypair
    ),
    referrer,
    mintAddress,
    signer: userKeypair.publicKey,
  });

  return {
    tx: result.tx,
    prefundTx,
  };
}

/**
 * Performs an atomic sponsored SOL deposit.
 */
export async function atomicSponsoredSolDeposit(params: {
  connection: Connection;
  userKeypair: Keypair;
  sponsorKeypair: Keypair;
  lamports: number;
  referrer?: string;
}): Promise<AtomicSponsoredDepositResult> {
  const { connection, userKeypair, sponsorKeypair, lamports, referrer } =
    params;

  // For SOL deposits, user needs both the deposit amount AND fee
  // We need to ensure they have the deposit amount (sponsored separately if needed)
  const prefundTx = await ensureMinimumBalance(
    connection,
    sponsorKeypair,
    userKeypair.publicKey
  );

  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromWallet(userKeypair);

  const lightWasm = await WasmFactory.getInstance();

  const result = await deposit({
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
    transactionSigner: createAtomicTransactionSigner(
      connection,
      sponsorKeypair,
      userKeypair
    ),
    referrer,
    signer: userKeypair.publicKey,
  });

  return {
    tx: result.tx,
    prefundTx,
  };
}

/**
 * Helper function to fetch AddressLookupTableAccount objects from their addresses
 */
async function getLookupTableAccounts(
  connection: Connection,
  lookups: readonly { accountKey: PublicKey }[]
): Promise<AddressLookupTableAccount[]> {
  const accounts: AddressLookupTableAccount[] = [];

  for (const lookup of lookups) {
    const result = await connection.getAddressLookupTable(lookup.accountKey);
    if (result.value) {
      accounts.push(result.value);
    }
  }

  return accounts;
}

/**
 * Checks if a user needs sponsorship for a deposit.
 * Returns the amount of SOL needed, or 0 if no sponsorship needed.
 */
export async function checkSponsorshipNeeded(
  connection: Connection,
  userPublicKey: PublicKey,
  minSolRequired: number = MIN_SOL_FOR_SDK_CHECK
): Promise<number> {
  const balance = await connection.getBalance(userPublicKey);
  const balanceInSol = balance / LAMPORTS_PER_SOL;

  if (balanceInSol >= minSolRequired) {
    return 0;
  }

  return minSolRequired - balanceInSol;
}

export { MIN_SOL_FOR_SDK_CHECK, MIN_LAMPORTS_FOR_SDK_CHECK };
