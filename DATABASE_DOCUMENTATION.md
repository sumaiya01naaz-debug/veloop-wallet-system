# Database Documentation — VELoop Rewards Wallet

The project uses MongoDB with Mongoose models. The wallet is stored separately from the ledger so that the current balance can be read efficiently while individual balance changes remain traceable as transaction records.

## Collections and relationships

```text
User (1) ─── (1) Wallet
  │
  ├──────── (many) WalletTransaction
  ├──────── (many) Withdrawal
  └──────── (many) AuditLog (as actor or target)

Withdrawal ─── WalletTransaction (transactionId reference)
PayoutMethod (1) ─── (many) PayoutOption (logical relationship through method/methodId)
```

## 1. User

Represents an authenticated account.

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | MongoDB document identifier |
| `name` | String | Required display name; trimmed |
| `email` | String | Required, unique, lowercased and trimmed |
| `passwordHash` | String | Required hashed password; never returned to ordinary API consumers |
| `accountStatus` | String | `ACTIVE` or `SUSPENDED`; defaults to `ACTIVE` |
| `role` | String | `USER` or `ADMIN`; defaults to `USER` |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

The authentication middleware verifies the JWT and then reads the current role and account status from MongoDB. The admin middleware requires an active account whose role is `ADMIN`.

## 2. Wallet

One wallet document is associated with each user. `userId` is required, references `User`, and is unique.

| Field | Type | Description |
|---|---|---|
| `userId` | ObjectId | Required unique reference to `User` |
| `ves` | Number | VEs balance; default 0; minimum 0 |
| `sves` | Number | SVEs balance; default 0; minimum 0 |
| `gems` | Number | Gems balance; default 0; minimum 0 |
| `tokens` | Number | Tokens balance; default 0; minimum 0 |
| `spins` | Number | Spins balance; default 0; minimum 0 |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

The wallet document is the current-balance read model. A balance update must be performed by backend service logic, not by accepting a balance value from the React client.

## 3. WalletTransaction

Stores the ledger record for each successful wallet change.

| Field | Type | Description |
|---|---|---|
| `userId` | ObjectId | Required reference to `User` |
| `currency` | String | `VES`, `SVES`, `GEMS`, `TOKENS` or `SPINS` |
| `type` | String | `CREDIT` or `DEBIT` |
| `amount` | Number | Required; minimum 0 |
| `balanceBefore` | Number | Balance immediately before the operation |
| `balanceAfter` | Number | Balance immediately after the operation |
| `source` | String | Required origin/reason, e.g. `WITHDRAWAL`, `WITHDRAWAL_REFUND` or administrative source |
| `referenceId` | String | Optional link to a related business record |
| `status` | String | `SUCCESS`, `PENDING` or `FAILED`; defaults to `SUCCESS` |
| `description` | String | Optional trimmed explanation |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Implemented indexes:

- `{ userId: 1, createdAt: -1 }` for a user's transaction history.
- `{ referenceId: 1 }` for related-record lookup.
- `{ status: 1, createdAt: -1 }` for status-oriented review.

A withdrawal debit points to the withdrawal's MongoDB ID through `referenceId`; the withdrawal also stores the ledger document ID in `transactionId`.

## 4. Withdrawal

Stores user redemption requests and their review state.

| Field | Type | Description |
|---|---|---|
| `userId` | ObjectId | Required reference to `User` |
| `method` | String | Payout method identifier; current withdrawal service accepts `upi` |
| `optionId` | String | Required selected payout option identifier |
| `currency` | String | VES; enum currently restricted to `VES` |
| `currencyAmount` | Number | Required VES amount to debit |
| `payoutAmount` | Number | Required payout amount, e.g. INR denomination |
| `payoutDetails` | Mixed | Required method-specific details; UPI service stores `upiId` |
| `status` | String | `PENDING`, `PROCESSING`, `APPROVED`, `REJECTED` or `CANCELLED` |
| `riskReviewRequired` | Boolean | Marks a request for additional review; defaults to false |
| `riskReason` | String | Optional reason the request was flagged |
| `rejectionReason` | String | Optional administrator rejection reason |
| `reviewNote` | String | Optional review note |
| `idempotencyKey` | String | Required request key, unique per user through a compound unique index |
| `transactionId` | ObjectId | Optional reference to the wallet debit transaction |
| `requestedAt` | Date | Defaults to current time |
| `processedAt` | Date | Set when reviewed/processed |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Implemented indexes:

- Unique `{ userId: 1, idempotencyKey: 1 }` to prevent duplicate user requests with the same key.
- `{ userId: 1, createdAt: -1 }` for withdrawal history.
- `{ userId: 1, status: 1, createdAt: -1 }` for filtered history.
- `{ transactionId: 1 }` for ledger-reference lookup.

## 5. PayoutMethod

Controls which payout methods are displayed and whether they are active/available.

| Field | Type | Description |
|---|---|---|
| `methodId` | String | Required unique method key, e.g. `upi` |
| `name` | String | Required display name |
| `description` | String | Optional description |
| `active` | Boolean | Defaults to true |
| `available` | Boolean | Defaults to true |
| `badge` | String | Optional UI badge |
| `displayOrder` | Number | Defaults to 0 |
| `unavailableReason` | String | Optional explanation shown when unavailable |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

The admin update endpoint allows changes to active/available state, unavailable reason, badge and display order. It records before/after values in `AuditLog`.

## 6. PayoutOption

Stores database-managed payout denominations and VES requirements.

| Field | Type | Description |
|---|---|---|
| `optionId` | String | Required unique option identifier |
| `method` | String | `upi`, `amazon_pay`, `google_play` or `paypal` |
| `payoutAmount` | Number | Required; minimum 1 |
| `payoutCurrency` | String | Defaults to `INR` |
| `requiredCurrency` | String | Defaults to `VES`; enum currently restricted to `VES` |
| `requiredAmount` | Number | Required VES amount; minimum 1 |
| `active` | Boolean | Defaults to true |
| `metadata` | Mixed | Optional additional configuration |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Implemented index: `{ method: 1, active: 1 }`.

The payout page reads option values from this collection. During withdrawal creation, the backend finds the active option by `optionId` and method and uses its `requiredAmount` and `payoutAmount`; a client-supplied withdrawal amount is not accepted as the source of truth.

## 7. AuditLog

Provides an audit trail for sensitive actions.

| Field | Type | Description |
|---|---|---|
| `actorId` | ObjectId | Optional reference to the user/admin performing the action |
| `action` | String | Required action name |
| `targetUserId` | ObjectId | Optional user affected by the action |
| `targetType` | String | `USER`, `WALLET`, `WITHDRAWAL`, `PAYOUT_OPTION` or `PAYOUT_METHOD` |
| `referenceId` | String | Optional related document/business reference |
| `metadata` | Mixed | Optional action details, including before/after values where applicable |
| `ipAddress` | String | Optional request IP address |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Implemented indexes:

- `{ action: 1, createdAt: -1 }`
- `{ referenceId: 1 }`
- `{ targetUserId: 1, createdAt: -1 }`
- `{ actorId: 1, createdAt: -1 }`

Audited events include withdrawal creation/approval/rejection, wallet credit/debit/correction, suspicious activity and payout configuration changes.

## Balance and ledger consistency

For a currency with successful ledger history, the reconciliation endpoint calculates:

```text
Expected balance = opening balance + total credits - total debits
```

It compares that expected value with the current wallet balance and the latest ledger `balanceAfter`. The endpoint is read-only.

A currency with no successful ledger records is returned as `NO_LEDGER_HISTORY`. It is not automatically treated as reconciled. Demonstration seed balances for non-VES currencies may predate the ledger records; an opening-balance ledger entry should be created for a currency before claiming complete historical reconciliation.

## Transaction boundaries

Withdrawal creation groups the VES debit, withdrawal document, debit ledger entry and creation audit event in a MongoDB session transaction. Rejection groups the status update, wallet refund, refund ledger entry and audit event in a transaction. The cancellation service also returns the deducted VES through a refund ledger entry.

MongoDB transactions require a deployment topology that supports replica-set transactions. MongoDB Atlas provides a suitable managed deployment option.
