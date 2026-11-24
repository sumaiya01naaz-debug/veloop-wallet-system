# Architecture — VELoop Rewards Wallet & Payout System

## 1. Overview

The project is a MERN-based wallet demonstration. React provides the user interface; Express exposes REST APIs; MongoDB stores users, current wallet balances, ledger records, payout configuration, withdrawal requests and audit events.

The backend is authoritative for all financial values. The frontend sends intent (selected method, option ID and payout details); the backend loads the actual redemption amount from the database and verifies the user's current balance.

## 2. High-level architecture

```text
React application (Vite)
  │
  │ Axios + Authorization: Bearer JWT
  ▼
Express application
  ├── /api/auth       → authentication controller
  ├── /api/wallet     → wallet controller / admin wallet controller
  ├── /api/payout     → payout controller
  ├── /api/withdrawals→ withdrawal controller / service
  └── /api/admin      → admin controller / wallet admin controller
          │
          ▼
  Middleware
  ├── JWT authentication
  ├── active-account check
  ├── ADMIN role authorization (admin routes)
  └── route-level rate limiters
          │
          ▼
  Services and Mongoose models
          │
          ▼
  MongoDB Atlas
  ├── User
  ├── Wallet
  ├── WalletTransaction
  ├── Withdrawal
  ├── PayoutMethod
  ├── PayoutOption
  └── AuditLog
```

## 3. Request authentication and authorization

1. The user submits email and password to `POST /api/auth/login`.
2. On successful authentication, the server returns a JWT.
3. The frontend stores the token in `sessionStorage` and Axios attaches it as `Authorization: Bearer <token>`.
4. The authentication middleware verifies the token using `JWT_SECRET`, loads the user from MongoDB and checks that the account is `ACTIVE`.
5. The middleware attaches the current database user ID and role to the request. The wallet APIs use this identity to scope user data.
6. Administrative routes additionally require the account role to be `ADMIN`.

The role is read from the database rather than trusted solely from an old client-side value.

## 4. Wallet balance and ledger strategy

The `Wallet` collection stores the current balance for each currency. `WalletTransaction` stores the individual credit/debit movements and records the before/after balance, amount, currency, source, status and reference.

The wallet service performs balance updates on the backend. Debits use a conditional update requiring the current balance to be at least the requested amount, then decrement the balance. This reduces the risk of a negative balance and prevents the client from choosing its own final balance.

For an administrative adjustment, the backend records a corresponding ledger transaction and audit event. The correction endpoint is a controlled administrative operation and is not available to normal users.

## 5. Withdrawal lifecycle

The current implementation uses **immediate deduction** rather than a separate reserved-balance field.

```text
User selects database-backed payout option
              │
              ▼
POST /api/withdrawals
              │
              ▼
Validate active user, method, option, UPI ID and idempotency key
              │
              ▼
Check VES balance and atomically deduct required VES
              │
              ▼
Create Withdrawal (normally PENDING)
              │
              ├── Create WalletTransaction DEBIT
              ├── Link transaction to withdrawal
              └── Create WITHDRAWAL_CREATED audit event
              │
              ▼
Admin review: PROCESSING → APPROVED or REJECTED
              │                         │
              │                         └── Rejected: refund VES + CREDIT ledger + audit
              │
              └── Pending user cancellation: CANCELLED + refund VES + CREDIT ledger
```

The debit, withdrawal record, ledger entry and creation audit event are grouped in a MongoDB transaction. If a critical operation in the transaction fails, the transaction is rolled back rather than leaving only part of the financial state updated.

A `PENDING` withdrawal has already had its VES deducted. Rejection or eligible cancellation returns the amount through a new credit transaction; the original debit is retained for audit history.

`APPROVED` is an administrator-reviewed state in this demonstration. It is not evidence that a real bank transfer has been executed. Provider integration and settlement confirmation are outside the current implementation.

## 6. Idempotency and suspicious activity review

Each withdrawal request includes an `idempotencyKey`. The database has a unique compound index on `{ userId, idempotencyKey }`. If the same user retries the same key, the existing withdrawal is returned rather than creating another debit. A duplicate-key race is also handled by looking up the existing record.

The service also checks recent withdrawal activity. In the tested demonstration scenario, three requests within ten minutes caused the third request to be flagged with `riskReviewRequired` and a reason, moved to `PROCESSING`, and recorded as suspicious activity in the audit log. This is a rule-based demonstration check, not a complete fraud-detection platform.

## 7. Payout configuration

`PayoutMethod` controls method display and availability. `PayoutOption` contains the payout denomination and required VES. The React application retrieves methods from `/api/payout/methods` and options from `/api/payout/options/:method`.

During withdrawal, the server looks up the option again and uses its stored values. This prevents a modified browser request from substituting a cheaper required-VES amount.

Only UPI is currently processed by the withdrawal service. Other methods can be configured for display as unavailable, but third-party payout execution is not integrated.

## 8. Administrative controls and auditability

Administrative endpoints are protected by authentication and role middleware. Administrators can list users, inspect wallets, review withdrawals, view transactions and audit events, inspect read-only reconciliation, correct balances and update payout-method configuration.

Sensitive operations write audit records with the actor, affected user or target type, action, reference, metadata and IP address where provided. Payout configuration changes store before/after metadata. Balance corrections record their type, amount and balance transition in audit metadata.

## 9. Rate limiting and application controls

The configured route limits are:

| Operation | Limit |
|---|---|
| Login | 10 attempts per IP per 15 minutes |
| Withdrawal creation | 5 requests per authenticated user per minute |
| Admin wallet mutations | 10 requests per administrator per minute |

CORS uses the configured `CLIENT_URL` allowlist. In production, Express trusts the configured reverse proxy hop so the application can operate behind the deployment proxy. For multi-instance production deployment, use a shared rate-limit store rather than relying on process-local state.

## 10. Reconciliation

The read-only reconciliation endpoint groups successful wallet transactions by currency and calculates:

```text
Expected balance = opening balance + credits - debits
```

It compares that value with the actual wallet balance and the last ledger balance. The result distinguishes `RECONCILED`, `DISCREPANCY` and `NO_LEDGER_HISTORY`. A currency without ledger entries cannot be independently reconciled from the available transaction history.

The current report is a balance-level reconciliation; it does not claim to validate every adjacent `balanceBefore`/`balanceAfter` pair in the full ledger chain.

## 11. Growth plan: 1,000 to 1,000,000 users

The existing application is a demonstration baseline. To support a million users, I would preserve the core accounting invariants while introducing operational components:

- **Database:** deploy a properly sized replica set, use sharding only after measuring access patterns and choosing a suitable shard key, and keep indexes aligned with actual query plans.
- **Ledger:** preserve an append-oriented, immutable financial history; implement correction entries rather than editing old ledger rows; add periodic consistency checks.
- **Transactions:** keep financial transactions short and bounded; use retry-safe transaction patterns and idempotency at API and worker boundaries.
- **Queues:** move provider calls, email/notifications, webhook processing and scheduled reconciliation into durable queues. Use an outbox pattern for reliable post-commit events.
- **Caching:** cache non-authoritative reference data and selected read views. Never use a cached balance as the final check for a debit.
- **Rate limiting:** use a shared store such as Redis for distributed limits across multiple backend instances.
- **Monitoring:** add structured logs, metrics, traces, alerts, queue-depth monitoring and an operational exception workflow for reconciliation mismatches.
- **Reliability:** implement provider callback authentication, idempotent settlement handling, retries with backoff, dead-letter handling and manual review for unresolved payouts.

These scale-up measures are future recommendations; they are not represented as currently deployed functionality.
