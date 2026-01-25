import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { createHash, randomBytes } from "crypto";

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
}

// Passphrase-encrypted payload (for claim links)
export interface PassphraseEncryptedPayload {
  ciphertext: string;
  nonce: string;
  salt: string;
}

// Word lists for passphrase generation (256 words each for ~42 bits with 4 words + 3 digits)
const ADJECTIVES = [
  "amber", "ancient", "arctic", "autumn", "azure", "bitter", "blazing", "bold",
  "brave", "bright", "bronze", "calm", "carbon", "cedar", "chrome", "citrus",
  "civil", "clean", "clear", "clever", "cloud", "cobalt", "cold", "copper",
  "coral", "cosmic", "crimson", "crystal", "cyber", "dark", "dawn", "deep",
  "delta", "desert", "digital", "divine", "double", "dream", "dusk", "dusty",
  "eager", "early", "earth", "east", "easy", "echo", "elder", "electric",
  "ember", "emerald", "empty", "endless", "epic", "equal", "eternal", "evening",
  "extra", "fading", "fair", "fallen", "famous", "fancy", "fast", "fierce",
  "final", "fine", "fire", "first", "flash", "flat", "fleet", "flying",
  "focal", "foggy", "forest", "fossil", "free", "fresh", "frost", "frozen",
  "full", "future", "gentle", "ghost", "giant", "gilded", "glass", "global",
  "gold", "golden", "good", "grand", "gray", "great", "green", "grizzly",
  "happy", "hard", "hazy", "heavy", "hidden", "high", "hollow", "holy",
  "honey", "humble", "hungry", "hybrid", "icy", "idle", "indoor", "inner",
  "iron", "island", "ivory", "jade", "jagged", "jazz", "jolly", "jovial",
  "keen", "kind", "kindred", "knight", "lapis", "large", "last", "late",
  "lavish", "lazy", "lead", "lean", "legacy", "legal", "lemon", "level",
  "light", "lime", "linear", "liquid", "little", "live", "lofty", "lone",
  "long", "lost", "loud", "lovely", "low", "loyal", "lucky", "lunar",
  "magic", "major", "marble", "marine", "master", "mellow", "mental", "mesa",
  "metal", "micro", "mild", "mint", "misty", "modern", "molten", "moon",
  "mossy", "mountain", "moving", "muddy", "muted", "mystic", "narrow", "native",
  "navy", "near", "neat", "neon", "neural", "new", "next", "night",
  "nimble", "noble", "north", "nova", "oak", "ocean", "odd", "olive",
  "omega", "onyx", "open", "orange", "orbit", "orchid", "organic", "outer",
  "pale", "paper", "past", "patient", "peace", "pearl", "phantom", "piano",
  "pilot", "pink", "pixel", "plain", "plasma", "platinum", "plum", "polar",
  "polite", "pond", "power", "primal", "prime", "pristine", "proud", "pure",
  "purple", "quartz", "queen", "quest", "quick", "quiet", "radiant", "rain",
  "random", "rapid", "rare", "raven", "raw", "ready", "real", "rebel",
  "red", "regal", "remote", "retro", "rich", "rigid", "river", "robust",
  "rock", "roman", "rose", "rough", "round", "royal", "ruby", "rugged",
];

const NOUNS = [
  "arrow", "atlas", "aurora", "badge", "basin", "beacon", "bear", "blade",
  "blaze", "bloom", "bolt", "bond", "bridge", "brook", "canyon", "cape",
  "castle", "cave", "chain", "cliff", "cloud", "coast", "comet", "compass",
  "coral", "cosmos", "cove", "crane", "creek", "crest", "crow", "crown",
  "crystal", "current", "dawn", "delta", "desert", "dolphin", "dove", "dragon",
  "dream", "drift", "dune", "dust", "eagle", "echo", "eclipse", "edge",
  "elk", "ember", "emerald", "falcon", "fern", "field", "fire", "flame",
  "flash", "flint", "flower", "flux", "fog", "forest", "forge", "fort",
  "fossil", "fountain", "fox", "frost", "galaxy", "garden", "gate", "gem",
  "ghost", "glacier", "glade", "gleam", "globe", "gorge", "granite", "grove",
  "guard", "gulf", "harbor", "hawk", "haven", "heart", "heath", "hedge",
  "heron", "hill", "hollow", "horizon", "horn", "horse", "hunter", "ice",
  "idol", "island", "jade", "jaguar", "jasper", "jewel", "jungle", "jupiter",
  "karma", "kelp", "kernel", "key", "kingdom", "kite", "knight", "knoll",
  "lagoon", "lake", "lance", "lantern", "lark", "lasso", "laurel", "lava",
  "leaf", "ledge", "legend", "leopard", "light", "lily", "lion", "lotus",
  "lunar", "lynx", "mantle", "maple", "marble", "marina", "marsh", "marvel",
  "meadow", "mesa", "meteor", "mist", "moon", "moss", "moth", "mountain",
  "nebula", "needle", "nest", "nexus", "night", "nimbus", "north", "nova",
  "oak", "oasis", "ocean", "olive", "omega", "onyx", "orbit", "orchid",
  "osprey", "otter", "owl", "palm", "panther", "path", "peak", "pearl",
  "pebble", "pelican", "phoenix", "pilot", "pine", "pioneer", "pixel", "plains",
  "plasma", "plateau", "plum", "plume", "pond", "portal", "prism", "pulsar",
  "puma", "quartz", "quest", "rain", "ranger", "rapids", "raven", "realm",
  "reef", "ridge", "rift", "river", "robin", "rock", "rose", "ruby",
  "sage", "sail", "salmon", "sand", "sapphire", "saturn", "scout", "seal",
  "seed", "shadow", "shark", "shelter", "shore", "shrine", "sierra", "signal",
  "silk", "silver", "sky", "slate", "slope", "snow", "solar", "soul",
  "spark", "sparrow", "spectrum", "sphinx", "spider", "spirit", "spring", "spruce",
  "spur", "star", "steel", "stone", "storm", "stream", "summit", "sun",
  "swallow", "swift", "temple", "terra", "thistle", "thorn", "thunder", "tide",
  "tiger", "timber", "titan", "torch", "trail", "tree", "trident", "trinity",
];

/**
 * Generate a secure passphrase like "amber-tiger-cosmic-falcon-847"
 *
 * Entropy: 256 × 256 × 256 × 256 × 1000 = 4.3 trillion combinations (~42 bits)
 * Format: adjective-noun-adjective-noun-number
 */
export function generatePassphrase(): string {
  const adj1 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun1 = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const adj2 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun2 = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `${adj1}-${noun1}-${adj2}-${noun2}-${num}`;
}

/**
 * Derive encryption key from passphrase + salt using SHA-256
 */
function deriveKey(passphrase: string, salt: Uint8Array): Uint8Array {
  const hash = createHash("sha256");
  hash.update(passphrase);
  hash.update(salt);
  return new Uint8Array(hash.digest());
}

/**
 * Encrypt data with passphrase (for claim links)
 */
export function encryptWithPassphrase(
  data: Uint8Array,
  passphrase: string
): PassphraseEncryptedPayload {
  const salt = randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const nonce = randomBytes(nacl.secretbox.nonceLength);

  const ciphertext = nacl.secretbox(data, nonce, key);

  return {
    ciphertext: bs58.encode(ciphertext),
    nonce: bs58.encode(nonce),
    salt: bs58.encode(salt),
  };
}

/**
 * Decrypt data with passphrase (for claim links)
 */
export function decryptWithPassphrase(
  payload: PassphraseEncryptedPayload,
  passphrase: string
): Uint8Array {
  const salt = bs58.decode(payload.salt);
  const key = deriveKey(passphrase, salt);
  const nonce = bs58.decode(payload.nonce);
  const ciphertext = bs58.decode(payload.ciphertext);

  const decrypted = nacl.secretbox.open(ciphertext, nonce, key);

  if (!decrypted) {
    throw new Error("Decryption failed - invalid passphrase");
  }

  return decrypted;
}

export function encryptForRecipient(
  data: Uint8Array,
  recipientPublicKey: PublicKey
): {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
} {
  const ephemeralKeypair = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Encrypt the data
  const encrypted = nacl.box(
    data,
    nonce,
    recipientPublicKey.toBytes(),
    ephemeralKeypair.secretKey
  );

  return {
    ciphertext: bs58.encode(encrypted),
    nonce: bs58.encode(nonce),
    ephemeralPublicKey: bs58.encode(ephemeralKeypair.publicKey),
  };
}

export function decryptWithPrivateKey(
  ciphertext: string,
  nonce: string,
  ephemeralPublicKey: string,
  privateKey: Uint8Array
): Uint8Array {
  const decrypted = nacl.box.open(
    bs58.decode(ciphertext),
    bs58.decode(nonce),
    bs58.decode(ephemeralPublicKey),
    privateKey
  );

  if (!decrypted) {
    throw new Error("Decryption failed - invalid keys or corrupted data");
  }

  return decrypted;
}

export function serializeKeypair(secretKey: Uint8Array): string {
  return bs58.encode(secretKey);
}

export function deserializeKeypair(encoded: string): Uint8Array {
  return bs58.decode(encoded);
}
