# PrivacyCash

This repository contains helper flows, sponsor logic, and test scripts used to support **PrivacyCash** deposits and withdrawals on Solana with **automatic gas sponsorship**.

The goal is simple:

- Users should **not need SOL** to interact
- Gas is **profiled and pre‑funded** via a sponsor wallet
- No funds are lost, even if a transaction fails midway

---

## 📁 Project Structure

```
.
├── app/                     # App entry (if any)
├── cache/                   # Local cache (gitignored)
├── lib/
│   ├── flows/               # High‑level gas & flow helpers
│   │   ├── ensureGasForClaim.ts
│   │   ├── ensureGasForDeposit.ts
│   │   └── ensureGasForWithdraw.ts
│   │
│   ├── gas/                 # Gas estimation & profiling
│   │   ├── constants.ts
│   │   ├── gasEstimator.ts
│   │   └── gasProfiles.ts
│   │
│   ├── privacycash/         # Thin wrappers around SDK
│   │   ├── client.ts
│   │   ├── deposit.ts
│   │   ├── withdraw.ts
│   │   ├── tokens.ts
│   │   └── index.ts
│   │
│   ├── sponsor/             # Sponsor wallet logic
│   │   ├── sponsorPolicy.ts
│   │   ├── sponsorSol.ts
│   │   └── sponsorWallet.ts
│   │
│   └── burner-wallet.ts     # Burner wallet utilities
│
├── tests/
│   ├── usdc-mainnet.test.ts # Mainnet USDC deposit/withdraw test
│   └── ...
│
├── .env.local               # Environment variables (not committed)
├── package.json
├── bun.lockb
└── README.md
```

---

## 🔑 Environment Setup

Create a `.env.local` file at the root of the repo:

```
# RPC
HELIUS_RPC=https://mainnet.helius-rpc-url

# Sender wallet (user / burner owner)
TEST_PRIVATE_KEY=BASE58_PRIVATE_KEY

# Sponsor wallet (pays gas)
SPONSOR_PRIVATE_KEY=BASE58_PRIVATE_KEY

# Safety switch for mainnet tests
CONFIRM_MAINNET_TEST=true
```

---

## 🧠 How Gas Sponsorship Works

This repo does **not** try to simulate exact transaction gas.

Instead it uses **profiling‑based sponsorship**:

1. Transactions are profiled once on mainnet
2. A safe SOL buffer is defined per flow
3. Sponsor pre‑funds the burner / sender wallet
4. Transaction executes
5. Any leftover SOL stays in the burner wallet

This avoids:

- RPC‑dependent simulations
- CU variance issues
- Version drift bugs

---

## 🔁 Flow Helpers

### `ensureGasForDeposit`

Ensures the sender has enough SOL to:

- Create ATA (if needed)
- Pay compute + signatures
- Perform USDC deposit

### `ensureGasForWithdraw`

Ensures the sender has enough SOL to:

- Execute PrivacyCash withdrawal
- Pay protocol + transfer fees

### `ensureGasForClaim`

Used when a recipient claims funds from a link / UTXO

All helpers:

- Check current SOL balance
- Top up only if required
- Use sponsor wallet as payer

---

## 🧪 Running Tests (Bun)

Install dependencies:

```
bun install
```

Run USDC mainnet test:

```
CONFIRM_MAINNET_TEST=true bun run test:usdc
```

This test:

1. Deposits USDC into PrivacyCash
2. Waits for indexer sync
3. Verifies private balance
4. Withdraws back to sender

---

## 💸 Fee Model (Important)

```
0.006 SOL × recipients + 0.35% of withdrawal amount
```

- `0.006 SOL` → gas & infra fee (paid in SOL)
- `0.35%` → protocol fee (deducted from USDC)

SOL and USDC fees are **independent**.

---

## ✅ Status

- ✔ Gas sponsorship implemented
- ✔ Deposit & withdraw flows working
- ✔ Mainnet tested with USDC
- ✔ No pending / lost funds

---

## 🧩 Notes

- Burner wallets may retain small SOL dust
- Sponsor wallet can be rotated anytime
- Indexer delay is expected (30–60s)

---

If something looks unused but is green — **it is intentional**.
Most files are modular to support future flows.
