# Design Document

## Overview

Three core operations:
1. **Direct Sends** - Send funds directly to a recipient
2. **Claim Links** - Send funds via a claimable link (passphrase-protected)
3. **Requests** - Request payment from someone

## Flows

### Direct Sends
1. Sender → PrivacyCash (sponsored)
2. PrivacyCash → Receiver (sponsored)

### Claim Links
1. Sender → PrivacyCash (sponsored) - deposit
2. PrivacyCash → Burner (sponsored) - breaks on-chain link
3. Burner → Receiver (sponsored, direct) - on claim

**Security:**
- Generate passphrase (e.g., "purple-tiger-42")
- Encrypt burner key with passphrase → `encryptedForReceiver`
- Encrypt burner key with sender's public key → `encryptedForSender`
- Passphrase NOT stored in DB
- Send link to receiver
- Send passphrase via separate channel (SMS/email)

**Reclaim:**
- Sender can reclaim anytime by signing with their key
- First to act wins (claim vs reclaim)
- No expiration

### Requests
1. Requestor creates request
2. Payer pays → goes through privacy flow
3. Requestor receives funds

## Fee Handling

| Flow | Who pays fee | UX |
|------|--------------|-----|
| Send (direct/claim) | Sender | "Send $60" → pay $60 + fees, they get $60 |
| Request | Requestor | "Pay me $60" → they pay $60, requestor gets $60 - fees |

**Edge case:** If sender doesn't have enough for amount + fees:
- Show max sendable amount
- Future: Toggle to deduct fees from amount (profile setting)

## Gas Sponsorship

All gas operations are sponsored:
- Sender → PrivacyCash
- PrivacyCash → Burner
- Burner → Receiver

User never needs to hold native token for gas.

## Database Schema

Single `activity` table for all operations:

```
activity {
  id
  type                  // send | request | claim
  senderHash
  receiverHash          // null for open requests, populated on claim
  amount
  tokenAddress          // null for native token
  status                // open | settled | cancelled
  message               // optional
  txHash                // settlement tx
  createdAt
  updatedAt

  // claim-specific (null for send/request)
  burnerAddress
  encryptedForReceiver
  encryptedForSender
  depositTxHash         // sender → privacy pool
  claimTxHash           // burner → receiver
}
```

## Design Decisions

- **Single activity table:** All operations (send, request, claim) in one table with `type` discriminator
- **Hashed addresses:** sender/receiver addresses stored as hashes for privacy
- **Burner address unhashed:** needed for balance checks
- **Consistent status:** `open | settled | cancelled` across all operations
- **Consistent naming:** `sender_hash`, `receiver_hash` (snake_case)
- **No expiration:** links stay open indefinitely
- **Message optional:** across all operations
- **Type values:** `send | request | claim`
- **Receiver address for requests:** stored unhashed since requester reveals their address

## API Endpoints

### Direct Send
```
POST /api/send
{
  senderPrivateKey: string,
  receiverAddress: string,
  amount: number,
  token: "USDC" | "SOL",
  message?: string
}
→ { activityId, fundTx, depositTx, withdrawTx, sweepTx, amountSent, feesPaid }
```

### Claim Links

**Create claim link:**
```
POST /api/claim/create
{
  senderPrivateKey: string,
  amount: number,
  token: "USDC" | "SOL",
  message?: string
}
→ { activityId, claimLink, passphrase, depositTx }
```
**Note:** Send passphrase via separate channel (SMS/email)!

**Redeem claim link:**
```
POST /api/claim/redeem
{
  activityId: string,
  passphrase: string,
  receiverAddress: string
}
→ { withdrawTx }
```

**Reclaim (sender takes back):**
```
POST /api/claim/reclaim
{
  activityId: string,
  senderPrivateKey: string
}
→ { withdrawTx }
```

### Payment Requests

**Create request:**
```
POST /api/request/create
{
  requesterAddress: string,
  payerAddress?: string,  // Optional - restrict to specific payer
  amount: number,
  token: "USDC" | "SOL",
  message?: string
}
→ { activityId, requestLink }
```

**Fulfill request:**
```
POST /api/request/fulfill
{
  activityId: string,
  payerPrivateKey: string
}
→ { fundTx, depositTx, withdrawTx, sweepTx, amountReceived, feesPaid }
```

**Cancel request:**
```
POST /api/request/cancel
{
  activityId: string,
  requesterAddress: string
}
→ { success: true }
```

### Activity

**Get activity by ID:**
```
GET /api/activity/[id]
→ Activity (without encrypted fields)
```

**Get user activities:**
```
GET /api/activity/user?address=...
→ { activities: Activity[], stats: { total_sent, total_received, total_claimed } }
```

## Sponsored Transaction Flow

The sponsor handles all gas fees:

1. **Pre-fund:** Sponsor transfers rent (for nullifier PDAs) + SDK minimum to sender
2. **Deposit:** Sender deposits to PrivacyCash
3. **Withdraw:** Relayer withdraws to receiver (relayer pays gas, takes fee)
4. **Sweep:** Sponsor recovers all remaining SOL from sender

Result: Sender ends with 0 SOL, sponsor spent ~0.00001 SOL.
