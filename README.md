# PrivacyCash

A privacy-focused payment platform built on Solana that enables users to send and receive funds without needing to hold native SOL for gas fees. The platform automatically sponsors all gas costs through a designated sponsor wallet while maintaining privacy through on-chain mixing.

## Features

- **Direct Sends** - Instant fund transfers through the privacy pool
- **Claim Links** - Passphrase-protected fund sharing with unlimited validity
- **Payment Requests** - Request payments from anyone with optional payer restrictions
- **Gas Sponsorship** - Users never need to hold SOL for transaction fees
- **Privacy Preservation** - Burner wallets break on-chain privacy links

---

## Project Structure

```
.
├── app/
│   └── api/
│       ├── send/                    # Direct send endpoints
│       │   ├── prepare/route.ts
│       │   └── submit/route.ts
│       ├── send_claim/              # Claim link endpoints
│       │   ├── prepare/route.ts
│       │   ├── submit/route.ts
│       │   ├── claim/route.ts
│       │   └── reclaim/route.ts
│       ├── request/                 # Payment request endpoints
│       │   ├── create/route.ts
│       │   ├── [id]/route.ts
│       │   ├── cancel/route.ts
│       │   └── fulfill/
│       │       ├── prepare/route.ts
│       │       └── submit/route.ts
│       └── activity/                # Activity history endpoints
│           ├── [id]/route.ts
│           └── user/route.ts
│
├── lib/
│   ├── sponsor/                     # Gas sponsorship & transaction building
│   │   ├── sponsorWallet.ts
│   │   ├── sponsorSol.ts
│   │   ├── sponsorPolicy.ts
│   │   ├── prepareAndSubmitSend.ts
│   │   ├── prepareAndSubmitClaim.ts
│   │   ├── prepareAndSubmitFulfill.ts
│   │   └── depositBuilder.ts
│   │
│   ├── privacycash/                 # PrivacyCash SDK wrappers
│   │   ├── client.ts
│   │   ├── tokens.ts
│   │   ├── deposit.ts
│   │   ├── withdraw.ts
│   │   └── index.ts
│   │
│   ├── flows/                       # High-level gas & flow helpers
│   │   ├── ensureGasForDeposit.ts
│   │   ├── ensureGasForWithdraw.ts
│   │   └── ensureGasForClaim.ts
│   │
│   ├── gas/                         # Gas estimation & profiling
│   │   ├── constants.ts
│   │   ├── gasEstimator.ts
│   │   └── gasProfiles.ts
│   │
│   ├── crypto.ts                    # Encryption utilities
│   ├── database.ts                  # Supabase operations
│   └── burner-wallet.ts             # Ephemeral wallet generation
│
├── supabase/
│   ├── schema.sql                   # Database schema
│   └── migrations/
│
├── tests/                           # Test suites
│
├── .env.example                     # Environment template
└── package.json
```

---

## Environment Setup

Copy `.env.example` to `.env` and fill in the values:

```env
# Solana RPC
RPC_URL=

# Wallets (base58 encoded secret keys)
SPONSOR_PRIVATE_KEY=
TEST_PRIVATE_KEY=
TEST_REQUESTOR_PRIVATE_KEY=          # Optional: used for request/claim tests

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Testing
CONFIRM_MAINNET_TEST=                # Set to "true" to enable mainnet tests
```

---

## API Endpoints

All write endpoints require `X-Session-Signature` header (base64 encoded 64-byte signature proving wallet ownership).

### Direct Send

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/send/prepare` | POST | Get unsigned deposit & sweep transactions |
| `/api/send/submit` | POST | Submit signed transactions |

### Claim Links

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/send_claim/prepare` | POST | Create claim link, returns passphrase |
| `/api/send_claim/submit` | POST | Submit signed deposit for link creation |
| `/api/send_claim/claim` | POST | Receiver redeems with passphrase |
| `/api/send_claim/reclaim` | POST | Sender reclaims unclaimed link |

### Payment Requests

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/request/create` | POST | Create payment request |
| `/api/request/[id]` | GET | Get request details |
| `/api/request/cancel` | POST | Cancel request |
| `/api/request/fulfill/prepare` | POST | Prepare payment for request |
| `/api/request/fulfill/submit` | POST | Submit payment |

### Activity

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/activity/[id]` | GET | Get specific activity |
| `/api/activity/user?address=...` | GET | Get user's history & stats |

---

## Payment Flows

### 1. Direct Send

Sender deposits to PrivacyCash, funds immediately withdraw to receiver. Both transactions are gas-sponsored.

### 2. Claim Links

1. Sender deposits to PrivacyCash
2. Funds withdraw to ephemeral "burner" wallet
3. Burner key encrypted with passphrase (for receiver) and session signature (for sender reclaim)
4. Receiver claims with passphrase, or sender can reclaim anytime
5. No expiration - links remain open indefinitely

### 3. Payment Requests

1. Requestor creates a payment request
2. Payer fulfills it through the privacy flow
3. Can optionally restrict to specific payer address

---

## Gas Sponsorship

This repo uses **profiling-based sponsorship** instead of simulation:

1. Transactions are profiled once on mainnet
2. A safe SOL buffer is defined per flow
3. Sponsor pre-funds the sender/burner wallet
4. Transaction executes
5. Remaining SOL swept back to sponsor

This avoids RPC-dependent simulations and CU variance issues.

---

## Fee Model

```
0.006 SOL x recipients + 0.35% of withdrawal amount
```

- `0.006 SOL` - gas & infra fee (paid in SOL, sponsored)
- `0.35%` - protocol fee (deducted from token)

---

## Running Tests

Install dependencies:

```bash
bun install
```

Run tests:

```bash
# USDC mainnet test
bun run test:usdc

# SOL mainnet test
bun run test:sol

# Direct send flow
bun run test:send

# Claim link flow
bun run test:claim

# Request fulfillment
bun run test:fulfill

# Dry run (simulation only)
bun run test:dry
```

---

## Tech Stack

- **Next.js** - Full-stack React framework
- **Solana Web3.js** - Blockchain interaction
- **PrivacyCash SDK** - Privacy mixing protocol
- **Supabase** - PostgreSQL database
- **TweetNaCl** - Encryption
- **Bun** - JavaScript runtime

---

## Notes

- Burner wallets may retain small SOL dust
- Sponsor wallet can be rotated anytime
- Indexer delay is expected (15-60s)
- Session signatures prove wallet ownership without storing keys
