# Test Report — VELoop Rewards Wallet & Payout System

## 1. Scope

This report records the implementation checks and functional test outcomes shared during development. The project uses a separate demonstration database. Amounts and balances below refer to test records, not real customer funds.

## 2. Test environment

- Backend: Node.js, Express.js and Mongoose
- Database: MongoDB Atlas (`veloop_wallet` demonstration database)
- Frontend: React and Vite
- API testing: Postman and project test scripts
- Deployment: Render backend and Vercel frontend

## 3. Functional test results

| ID | Scenario | Expected result | Observed result | Status |
|---|---|---|---|---|
| T01 | Wallet service credit and debit | Credit increases balance; debit decreases it and creates ledger history | Test output showed `+100 VEs`, `-50 VEs`, current VEs `25050` and 2 test transactions | PASS |
| T02 | Create UPI withdrawal | Server reads the option, deducts the required VES and creates a pending withdrawal and debit ledger record | Withdrawal submission succeeded with `PENDING`; transaction record was created | PASS |
| T03 | Insufficient VES | Withdrawal must be rejected and balance must remain unchanged | Insufficient-balance error was verified in the withdrawal flow | PASS |
| T04 | User cancels pending withdrawal | Status becomes `CANCELLED`; deducted VES are refunded through a credit ledger record | Cancellation and refund were verified; test wallet returned to `20,000` VES | PASS |
| T05 | Admin rejects pending withdrawal | Status becomes `REJECTED`; VES are refunded and history retained | Rejection/refund was verified; test wallet returned to `20,000` VES | PASS |
| T06 | Admin rejects a processing withdrawal | A reviewable `PROCESSING` withdrawal can be rejected and refunded | Processing then rejection was verified; test wallet returned to `20,000` VES | PASS |
| T07 | Suspicious withdrawal frequency | Repeated requests are flagged for review and audit | Third request in the tested sequence within ten minutes moved to `PROCESSING`, with `riskReviewRequired: true`, a risk reason and a suspicious-activity audit entry | PASS |
| T08 | Admin balance correction | Controlled correction updates balance and records before/after audit data | Both `+10` and `-10` correction tests were performed; balance was restored to `20,000` and audit entries were created | PASS |
| T09 | Payout configuration update | Admin update changes configuration and records before/after state | Amazon Pay badge was changed for testing and restored; `PAYOUT_CONFIGURATION_CHANGED` audit entries were observed | PASS |
| T10 | Wallet reconciliation | Expected balance should equal current wallet and last ledger balance when ledger history exists | VES: opening balance + credits - debits matched `20,000`; actual and last ledger balance were `20,000`; difference `0` | PASS for VES |
| T11 | Other currency reconciliation | A currency without ledger entries must not be incorrectly reported as reconciled | SVES, GEMS, TOKENS and SPINS were returned as `NO_LEDGER_HISTORY` | EXPECTED LIMITATION |
| T12 | Admin data access | Admin can review users, wallets, withdrawals, transactions and audit logs | Administrative API reads and dashboard tabs were exercised during development | PASS |
| T13 | Frontend build | Vite production build completes | `npm run build` completed successfully in the development checks shared | PASS |
| T14 | Backend syntax/startup | Backend files parse and application connects to MongoDB | Relevant `node --check` checks and a MongoDB-connected server startup were reported successful after the startup fix | PASS (after startup fix) |

## 4. Security and edge-case coverage

| Requirement | Implementation evidence | Test evidence in the shared development record |
|---|---|---|
| JWT authentication | Bearer token verification; active user reloaded from database | Login and protected APIs were exercised |
| Admin authorization | Dedicated `requireAdmin` middleware checks active account and ADMIN role | Admin endpoints/dashboard were exercised |
| Insufficient-balance protection | Atomic debit filter requires `ves >= requiredAmount` | Insufficient-balance rejection verified |
| Duplicate withdrawal protection | Per-user unique idempotency-key index and duplicate-key recovery | Idempotency implementation present; retain/attach the specific duplicate-request test output if available |
| Concurrent debit safety | Conditional atomic wallet decrement and MongoDB transaction | A concurrent-withdrawal test script exists in the working project; attach its actual output before claiming a measured concurrency pass |
| Invalid payout option | Server looks up an active option by method and option ID | Validation is implemented; record a negative test response if captured |
| Cross-user access protection | Wallet and withdrawal reads are scoped to authenticated user ID | Authorization logic is implemented; include a second-user denial result if captured |
| Rate limiting | Login, withdrawal and admin wallet mutation limiters are configured | Rate-limit test scripts exist; retain their output as evidence if required |
| Client amount manipulation | Required VES is loaded from the database option, not trusted from the request | Server-side lookup is implemented; attach a tampered-request result if captured |

## 5. Reconciliation interpretation

The reconciliation endpoint is read-only. It compares the ledger-derived balance with the wallet document and the last recorded ledger balance for each currency. In the test dataset, VES reconciled with a zero difference. The other four wallet currencies had seeded balances but no successful ledger entries, so the report correctly returned `NO_LEDGER_HISTORY` rather than claiming that those balances were reconciled.

The current reconciliation check is balance-level; it does not validate every historical adjacent `balanceBefore`/`balanceAfter` pair.

## 6. Known limitations

1. The withdrawal service currently executes the UPI request workflow only. Other displayed methods are not live payout integrations.
2. `APPROVED` is an administrator-reviewed state in the demonstration, not proof of bank settlement.
3. Non-VES seeded opening balances do not yet have a demonstrated ledger baseline; those currencies remain `NO_LEDGER_HISTORY` until opening entries are established.
4. The test evidence for idempotency, concurrent requests, invalid option, cross-user denial, rate limits and tampered client requests should be supplemented with captured request/response or script output if those cases are included in the formal demo package.

## 7. Recommended final smoke test before submission

- Log in through the live frontend with the intended demo USER account.
- Confirm wallet and recent transactions load from the deployed backend.
- Load payout methods and UPI voucher options.
- Submit one valid UPI request using a test-only UPI ID and confirm a pending withdrawal is created.
- Confirm VES decreases and the matching debit appears in ledger history.
- Sign in with the intended ADMIN account and inspect the withdrawal and audit trail.
- Reject the test withdrawal if appropriate and confirm the refund ledger entry and restored VES balance.
- Confirm Render has completed deployment and the Vercel frontend can still reach the backend.

Do not use a real bank account or real payout credentials for a public demonstration recording.
