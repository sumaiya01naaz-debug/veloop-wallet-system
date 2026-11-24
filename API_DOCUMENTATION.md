# API Documentation — VELoop Rewards Wallet

This document describes the HTTP routes mounted by the Express application. Unless stated otherwise, examples use the local API base URL:

```text
http://localhost:5000/api
```

For the deployed demonstration API, use:

```text
https://veloop-wallet-backend.onrender.com/api
```

## Authentication

Most endpoints require a JWT in the HTTP `Authorization` header:

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

Obtain a token by calling `POST /auth/login` with a valid demo user's email and password. The frontend stores the returned token in `sessionStorage` and Axios attaches it to API requests. Do not include real passwords or tokens in exported documentation.

Roles:

- **USER:** can read their own wallet, transactions, payout configuration and withdrawals; create and cancel their own eligible withdrawal.
- **ADMIN:** can access administrative review, wallet adjustment, reconciliation and payout configuration endpoints.

## Common response conventions

Successful JSON responses generally include `success: true`. Errors generally include `success: false` and a human-readable `message`. Paginated list responses include a `pagination` object containing `page`, `limit`, `total` and `totalPages`.

## 1. Authentication

### POST `/auth/login`

- Authentication: not required
- Rate limit: 10 attempts per IP in 15 minutes
- Request body:

```json
{
  "email": "demo@example.test",
  "password": "<demo-password>"
}
```

- Success: returns a JWT in `token`; the frontend uses `response.data.token`.
- Typical errors: `401` for invalid credentials; `429` when the login rate limit is exceeded.

## 2. Wallet

### GET `/wallet`

- Authentication: USER or ADMIN
- Returns the authenticated user's wallet.
- The user identity is taken from the JWT; callers cannot select another user's wallet through a query parameter.
- Response shape used by the frontend:

```json
{
  "success": true,
  "wallet": {
    "ves": 20000
  }
}
```

The numeric values above are illustrative only.

### GET `/wallet/transactions?page=1&limit=20`

- Authentication: USER or ADMIN
- Returns the authenticated user's wallet ledger entries with pagination.
- Query parameters: `page` (default 1) and `limit` (frontend uses 5 for recent transactions; the history view can request a larger page size).
- Response includes `success`, `transactions` and `pagination`.

### GET `/wallet/summary`

- Authentication: USER or ADMIN
- Returns a wallet summary for the authenticated user. The exact fields are determined by the controller response; consumers should use the returned fields rather than calculate authoritative balances in the browser.

### POST `/wallet/credit`

- Authentication: ADMIN only
- Rate limit: 10 wallet mutation requests per administrator per minute
- Performs an administrative wallet credit through the wallet administration controller. The backend assigns the `ADMIN_CREDIT` source and creates the ledger record.
- This route is not available to ordinary users.
- Request body:

```json
{
  "userId": "<target-user-object-id>",
  "currency": "VES",
  "amount": 500,
  "description": "Demonstration credit",
  "referenceId": "optional-reference"
}
```

- `currency` must be one of `VES`, `SVES`, `GEMS`, `TOKENS` or `SPINS`; `amount` must be a positive safe integer; `description` is required and limited to 250 characters. The target user must exist and be active. The response includes `success`, `message` and `transaction`.

### POST `/wallet/debit`

- Authentication: ADMIN only
- Rate limit: 10 wallet mutation requests per administrator per minute
- Performs an administrative debit. The backend assigns the `ADMIN_DEBIT` source, verifies sufficient balance and records the wallet change.
- Request body uses the same fields as `/wallet/credit`: `userId`, `currency`, `amount`, `description` and optional `referenceId`. The frontend must never set a wallet balance directly. The response includes `success`, `message` and `transaction`.

## 3. Payout configuration

### GET `/payout/methods`

- Authentication: USER or ADMIN
- Returns payout methods stored in the database, including their active/available configuration and display information.
- Response includes `success` and `methods`.

### GET `/payout/options/:method`

- Authentication: USER or ADMIN
- Example: `GET /payout/options/upi`
- Returns active payout options for the specified method from MongoDB.
- Response includes `success` and `options`. Each option exposes its `optionId`, `payoutAmount`, `payoutCurrency`, `requiredCurrency` and `requiredAmount` fields as applicable.
- The withdrawal service currently accepts `upi` only. An option ID and its required VES amount are validated/looked up on the backend.

## 4. User withdrawals

### POST `/withdrawals`

- Authentication: USER or ADMIN
- Rate limit: 5 requests per authenticated user per minute
- Creates a withdrawal request.
- Request body:

```json
{
  "method": "upi",
  "optionId": "<active-upi-option-id>",
  "payoutDetails": {
    "upiId": "example@upi"
  },
  "idempotencyKey": "<unique-request-key>"
}
```

- The request does not supply an amount to debit. The backend obtains the payout value and required VES from the active database option.
- The backend validates the user account, method, option, UPI ID and idempotency key; verifies sufficient VES; then atomically deducts VES and creates the withdrawal, debit ledger entry and audit record.
- Success response includes `success`, `message` and `withdrawal`. The new withdrawal begins as `PENDING` unless suspicious-activity review rules route it to `PROCESSING`.
- Typical errors: `400` for invalid method/option/details or insufficient balance; `403` for an unavailable user account; `404` for a missing wallet; `429` for rate limiting.

### GET `/withdrawals?page=1&limit=20&status=all`

- Authentication: USER or ADMIN
- Returns only the authenticated user's withdrawals.
- Supported status filters in the controller include `all`, `pending`, `processing`, `paid` (maps to `APPROVED`), `rejected` and `cancelled`.
- Response includes `success`, `withdrawals` and `pagination`. Payout details are excluded from the user's list response.

### GET `/withdrawals/:id`

- Authentication: USER or ADMIN
- Returns a withdrawal only when it belongs to the authenticated user.
- Invalid IDs return `400`; a record not owned by the user or not found returns `404`.

### PATCH `/withdrawals/:id/cancel`

- Authentication: USER or ADMIN
- Cancels the authenticated user's eligible pending withdrawal.
- The backend changes the state and refunds the debited VES with a credit ledger record. A request that is no longer cancellable is rejected.

## 5. Administrative withdrawal review

These endpoints require both a valid JWT and the `ADMIN` role.

### PATCH `/withdrawals/:id/process`

Moves a reviewable pending withdrawal into `PROCESSING`. It is intended for administrator review. This does not call an external payout provider.

### PATCH `/withdrawals/:id/approve`

Request body (review note is optional):

```json
{
  "reviewNote": "Reviewed for demonstration."
}
```

Moves a reviewable `PENDING` or `PROCESSING` withdrawal to `APPROVED` and records an audit event. This is an administrative status decision, not proof of an external bank settlement.

### PATCH `/withdrawals/:id/reject`

Request body:

```json
{
  "rejectionReason": "Unable to verify the payout request.",
  "reviewNote": "Reviewed by administrator."
}
```

A non-empty rejection reason is required. A valid rejected withdrawal is refunded through a wallet credit and matching ledger entry. The action is audited.

## 6. Administrative wallet and audit operations

All endpoints in this section require an active ADMIN account.

### GET `/admin/users?page=1&limit=20&search=demo`

Lists users. Supports name/email search and pagination. Returned user fields exclude password hashes.

### GET `/admin/users/:userId/wallet`

Returns the selected user's basic profile and wallet balances. `userId` must be a valid MongoDB ObjectId.

### GET `/admin/withdrawals?status=PENDING&page=1&limit=20`

Lists withdrawals across users. Optional filters: `status` (`PENDING`, `PROCESSING`, `APPROVED`, `REJECTED`, `CANCELLED`, or `ALL`) and `userId`. The list excludes payout details and idempotency keys.

### GET `/admin/withdrawals/:id`

Returns one administrative withdrawal record, populated with user details and related transaction information. This authorized detail endpoint includes payout details for review; keep its response private.

### GET `/admin/transactions?page=1&limit=20&currency=VES&type=DEBIT&status=SUCCESS`

Lists ledger transactions across users. Optional filters include `userId`, `currency`, `type`, `status` and `source`.

### GET `/admin/audit-logs?page=1&limit=20`

Lists audit events. Optional filters include `actorId`, `targetUserId`, `action`, `targetType` and `referenceId`.

### GET `/admin/users/:userId/reconciliation`

Returns a read-only reconciliation report for VES, SVES, GEMS, TOKENS and SPINS. For currencies with successful ledger entries, the report calculates:

```text
Expected balance = opening balance + credits - debits
```

It compares the expected balance with the current wallet and last ledger balance. A currency without successful ledger entries is reported as `NO_LEDGER_HISTORY`, not as a zero balance or a confirmed reconciliation.

### POST `/admin/wallet/correct`

- Authentication: ADMIN only
- Creates a controlled wallet balance correction and records a dedicated `BALANCE_CORRECTION` audit event.
- Request body:

```json
{
  "userId": "<target-user-object-id>",
  "currency": "VES",
  "amount": 10,
  "direction": "CREDIT",
  "description": "Correction after wallet review",
  "referenceId": "optional-reference"
}
```

- `userId` must be a valid MongoDB ObjectId for an existing active user.
- `currency` must be one of `VES`, `SVES`, `GEMS`, `TOKENS` or `SPINS`.
- `amount` must be a positive safe integer; `description` is required and limited to 250 characters.
- `direction` is required and must be `CREDIT` or `DEBIT`.
- `referenceId` is optional and is passed to the wallet service as a transaction reference.
- A debit correction is still subject to sufficient-balance validation.
- The audit entry records the actor, target, currency, amount, correction direction/source and before/after balance information. Never submit a manually calculated final balance.

### PATCH `/admin/payout-methods/:methodId`

Updates the administrative configuration for a payout method and creates a `PAYOUT_CONFIGURATION_CHANGED` audit event with before/after metadata.

Allowed request fields:

```json
{
  "active": true,
  "available": false,
  "unavailableReason": "Provider integration is not configured.",
  "badge": "Popular",
  "displayOrder": 1
}
```

Only supplied allowed fields are changed. `active` and `available` must be booleans; `displayOrder` must be an integer from 0 to 9999. The current backend only permits setting UPI to available.

## 7. Authentication and common errors

| HTTP status | Meaning | Examples |
|---:|---|---|
| 400 | Invalid request or business rule | Invalid payout option, invalid UPI ID, insufficient VES |
| 401 | Missing/invalid/expired token | Authentication required |
| 403 | Authenticated user is not permitted | Admin access required; inactive account |
| 404 | Resource not found | Wallet/user/withdrawal not found |
| 409 | Withdrawal state conflict | Already processed or no longer reviewable |
| 429 | Rate limit exceeded | Login or withdrawal limit |
| 500 | Unexpected server error | Generic operation failure response |

## Notes

- The API is a demonstration implementation; the actual response fields should be taken from the current controller code.
- Do not expose payout details, JWTs, password hashes, MongoDB connection strings or environment secrets in logs or public examples.
- There is no claim of a live payout-provider integration. The current withdrawal execution path is UPI request validation plus internal wallet and withdrawal state management.
