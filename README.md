# Swish

## Venmo, but private.

Send money to anyone. Request payments. Share claim links. **Without anyone knowing.**

Swish brings the simplicity of Venmo to crypto—with zero-knowledge privacy. Just private payments.

**Live:** [swish.cash](https://swish.cash)

---

## What Makes Swish Different

### We Built Venmo Flows—With Privacy

| Feature | Venmo | Swish |
|---------|-------|-------|
| Send to anyone | ✓ | ✓ + **private** |
| Request payments | ✓ | ✓ + **private** |
| Payment links | ✓ | ✓ + **private** |
| Transaction history | Public feed | **Only you see it** |
| On-chain trace | N/A | **None** |

Privacy protocols exist. Payment apps exist. However, Swish is a Venmo-style experience with ZK privacy.

### Claim Links

Ever sent a Venmo link? "Pay me at venmo.com/username"?

We built something better: **private claim links**.

```
https://swish.cash/c/abc123
Passphrase: purple-tiger-red-panda-42
```

Share the link anywhere. Send the passphrase separately. Receiver claims the funds. **No one can trace it back to you.**

- No expiration
- Sender can reclaim anytime
- Passphrase-protected (like a private key, but human-readable)
- Funds sit in an ephemeral "burner" wallet until claimed

---

## Three Ways to Pay

### 1. Direct Send

**"I'll send you $50"**

The simplest flow. You send, they receive. Through the privacy pool, so there's no on-chain link.

```
You → Privacy Pool → Them
     (link broken)
```

**How it works:**
1. You deposit USDC into the PrivacyCash pool
2. Pool generates a ZK proof of your deposit
3. Receiver withdraws from the pool
4. On-chain: two unrelated transactions. Off-chain: you sent them money.

### 2. Claim Links

**"Here's $50, claim it when you're ready"**

Perfect for: gifts, tips, paying someone who's not on Solana yet, or when you don't know their address.

```
You → Privacy Pool → Burner Wallet
                          ↓
              [Link + Passphrase shared]
                          ↓
                    They claim it
```

**How it works:**
1. You create a claim link (deposits to pool, withdraws to burner)
2. You get a link and passphrase
3. Share link publicly (Twitter, email, anywhere)
4. Share passphrase privately (DM, SMS, in person)
5. Receiver enters passphrase, claims funds
6. If unclaimed, you can reclaim anytime

**The magic:** Even if someone sees the claim link, they can't claim without the passphrase. And the burner wallet breaks any on-chain connection to you.

### 3. Payment Requests

**"Pay me $50"**

Like Venmo's request feature. You create a request, share the link, they pay.

```
You create request → Share link → They pay → You receive
                                    ↓
                            (through privacy pool)
```

**How it works:**
1. You create a request: "Pay me $50 USDC"
2. Get a shareable link: `swish.cash/r/xyz789`
3. Anyone (or a specific address) can pay
4. Payment goes through privacy pool
5. You receive funds, request marked settled

---

## The Gasless Dream

### What We Were Trying to Achieve

We wanted Swish to feel like Venmo—**you shouldn't think about gas**.

In Venmo, you don't care about network fees. Simple.

In crypto? "Sorry, I can't send you USDC because I don't have SOL for gas." Terrible UX.

**Our goal:** A sponsor wallet pays all gas fees behind the scenes. User never touches SOL.

### How Far We Got

We built the entire infrastructure for it. We also ran simulations for it in test files:

```typescript
// This is real code in our codebase
const tx = await buildDepositSPLTransaction({
  userPublicKey: user.publicKey,
  sponsorPublicKey: sponsor.publicKey,  // ← Sponsor pays gas
  sessionSignature,
  amount,
  token: "USDC",
});

// User signs (authorizes deposit)
// Sponsor signs (pays fee)
// User's SOL balance: unchanged
```

**What works:**
- ✅ Building unsigned transactions with custom fee payer
- ✅ Sponsor co-signing for gas payment
- ✅ Pre-funding and sweeping sponsor SOL
- ✅ Full test suite proving it works

**What's live:**
- Users pay their own gas for deposits (simpler for hackathon)
- **Sponsor pays for claim/reclaim** (burner wallet has no SOL)

The infrastructure is there. Flipping to full sponsorship is a config change.

### Why We Had to Go Deep

The PrivacyCash SDK doesn't support what we needed:

```typescript
// SDK's API (what it provides)
const client = new PrivacyCash({ owner: userKeypair });
await client.deposit({ amount }); // Signs internally, user pays gas

// What we needed
const unsignedTx = buildTx({ sponsorAsPayer: true });
// Return to frontend → User signs in wallet → Submit
```

So we reverse-engineered the SDK internals:

```typescript
// We import SDK internal modules directly
import { Utxo } from "privacycash/dist/models/utxo.js";
import { prove } from "privacycash/dist/utils/prover.js";
import { MerkleTree } from "privacycash/dist/utils/merkle_tree.js";
import { EncryptionService } from "privacycash/dist/utils/encryption.js";
import { getUtxosSPL } from "privacycash/dist/getUtxosSPL.js";
```

We wrote **370+ lines** in `depositBuilder.ts` that reconstructs the SDK's deposit flow—but gives us control over the fee payer and returns unsigned transactions.

No documentation for this. Pure source code reading.

---

## Technical Deep Dive

### The Prepare/Submit Pattern

Every payment in Swish follows this pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                         PREPARE PHASE                            │
├─────────────────────────────────────────────────────────────────┤
│  Client: POST /api/send/prepare                                  │
│  Server: Builds unsigned transaction                             │
│          - Fetches UTXOs, merkle proofs                         │
│          - Generates ZK proof (3-5 seconds)                     │
│          - Returns serialized unsigned tx                        │
│  Client: Receives unsigned tx                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         SIGN PHASE                               │
├─────────────────────────────────────────────────────────────────┤
│  Client: wallet.signTransaction(unsignedTx)                      │
│          User approves in Phantom/Solflare/etc                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         SUBMIT PHASE                             │
├─────────────────────────────────────────────────────────────────┤
│  Client: POST /api/send/submit { signedTx }                      │
│  Server: Submits deposit to PrivacyCash relayer                  │
│          Waits for indexer (15-60 seconds)                       │
│          Executes withdraw to receiver                           │
│  Client: Success! Funds sent privately.                          │
└─────────────────────────────────────────────────────────────────┘
```

### Session Signatures: One Sign, Use Everywhere

When you connect your wallet, you sign one message:

```
"Privacy Money account sign in"
```

This signature is used to:
1. **Prove wallet ownership** (authentication)
2. **Derive encryption keys** (for UTXO encryption)
3. **Enable reclaim** (sender can decrypt burner key)

You sign once. We use it for every transaction in your session. No repeated popups.

### The Burner Wallet System

For claim links, we use ephemeral "burner" wallets:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sender    │────►│   Privacy   │────►│   Burner    │
│   Wallet    │     │    Pool     │     │   Wallet    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────────────┐
        │  Burner key encrypted with:     │
        │  • Passphrase (for receiver)    │
        │  • Session sig (for sender)     │
        └─────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   ┌─────────┐            ┌──────────┐
   │  Claim  │            │  Reclaim │
   │ (receiver)           │  (sender) │
   └─────────┘            └──────────┘
```

The burner wallet:
- Generated fresh for each claim link
- Holds only tokens (no SOL)
- Key encrypted two ways (passphrase + session signature)
- Deleted after claim/reclaim

---

## What We Built

### Frontend
- **Home** (`/`) - Amount input, send/request buttons
- **Claim page** (`/c/[id]`) - Enter passphrase, claim funds
- **Request page** (`/r/[id]`) - View request, pay it
- **Profile** (`/p`) - Transaction history, stats

### Backend API

| Endpoint | Description |
|----------|-------------|
| `POST /api/send/prepare` | Build unsigned send transaction |
| `POST /api/send/submit` | Submit signed transaction |
| `POST /api/send_claim/prepare` | Create claim link |
| `POST /api/send_claim/submit` | Finalize claim link |
| `POST /api/send_claim/claim` | Redeem with passphrase |
| `POST /api/send_claim/reclaim` | Sender takes back |
| `POST /api/request/create` | Create payment request |
| `POST /api/request/fulfill/prepare` | Prepare to pay request |
| `POST /api/request/fulfill/submit` | Complete payment |
| `POST /api/request/cancel` | Cancel request |

### Core Libraries

| File | What It Does |
|------|--------------|
| `lib/sponsor/depositBuilder.ts` | Custom tx builder using SDK internals |
| `lib/sponsor/prepareAndSubmitSend.ts` | Direct send flow |
| `lib/sponsor/prepareAndSubmitClaim.ts` | Claim link flow |
| `lib/sponsor/prepareAndSubmitFulfill.ts` | Request fulfillment flow |
| `lib/crypto.ts` | Encryption for burner keys |
| `hooks/useSessionSignature.ts` | Wallet auth + key derivation |

---

## Test Suite

We tested extensively. Every flow, edge case, mainnet.

```bash
bun install

# Test each flow
bun run test:send      # Direct send
bun run test:claim     # Claim links
bun run test:fulfill   # Request fulfillment

# Mainnet tests (real USDC)
bun run test:usdc      # Requires CONFIRM_MAINNET_TEST=true

# Sponsor testing
bun run test:sponsor   # Sponsor-paid transactions
```

| Test File | Coverage |
|-----------|----------|
| `prepare-submit-send.test.ts` | Full API flow for sends |
| `prepare-submit-claim.test.ts` | Claim link creation + redemption |
| `prepare-submit-fulfill.test.ts` | Request payment flow |
| `sponsored-send.test.ts` | Sponsor as fee payer |
| `atomic-sponsor.test.ts` | Atomic sponsor patterns |
| `usdc-mainnet.test.ts` | Real mainnet transactions |

---

## The Effort

### What We Had to Figure Out

1. **PrivacyCash SDK internals** - No docs. Read source code to understand UTXO model, merkle trees, ZK proofs.

2. **Unsigned transactions** - SDK only provides sign-and-submit. We rebuilt the deposit flow to return unsigned txs.

3. **Custom fee payer** - Solana allows any signer to pay fees if you structure it right. Took iterations to get working. Simulations present in the code.

4. **Session-based encryption** - Derive encryption keys from wallet signature, not private key (which we never have).

5. **Burner wallet security** - Encrypt for two parties (receiver + sender) with different keys.

6. **Privy + Next.js** - SSR hydration issues with wallet hooks. Lots of debugging.

### Time Breakdown

| Area | Effort |
|------|--------|
| Understanding PrivacyCash SDK | ~25% |
| Building `depositBuilder.ts` | ~20% |
| Gas sponsorship infrastructure | ~20% |
| UI/UX (React, Privy, Framer) | ~15% |
| Claim link encryption/security | ~10% |
| Testing + debugging | ~10% |

### What We're Proud Of

1. **Claim links work** - Private payment links, passphrase-protected, reclaimable
2. **Full ZK privacy** - Every transaction through the mixing pool
3. **Gasless infrastructure** - Code is there, sponsor logic works
4. **Clean UX** - Feels like Venmo, not like crypto
5. **Comprehensive tests** - Mainnet-tested, edge cases covered

---

## Run It Yourself

### Environment

```env
# Solana
RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com

# Sponsor (pays gas for claim/reclaim)
SPONSOR_PRIVATE_KEY=<base58>

# Privy
NEXT_PUBLIC_PRIVY_APP_ID=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=https://swish.cash
```

### Development

```bash
npm install
npm run dev
```

### Tech Stack

- **Next.js 15** - App router, API routes, edge runtime
- **Solana Web3.js** - Transaction building
- **PrivacyCash SDK** - ZK privacy (+ internals)
- **Privy** - Wallet authentication
- **Supabase** - Database
- **Framer Motion** - Animations
- **TweetNaCl** - Encryption

---

## Links

- **Live App:** [swish.cash](https://swish.cash)
- **PrivacyCash:** [privacy.cash](https://privacy.cash)

---

**Swish: Send money like it's nobody's business. Because it isn't.**
