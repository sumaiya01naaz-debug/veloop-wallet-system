# VELoop Rewards Wallet & Payout System

A backend-driven wallet and withdrawal demonstration built with the MERN stack. The backend is the source of truth for wallet balances, payout eligibility, withdrawal amounts and transaction records. The React frontend is a demonstration interface for authenticated users and administrators.

## Live project

- **Frontend:** https://veloop-wallet-system-zeta.vercel.app
- **Backend:** https://veloop-wallet-backend.onrender.com
- **GitHub:** https://github.com/sumaiya01naaz-debug/veloop-wallet-system
- **Backend health/root:** https://veloop-wallet-backend.onrender.com/

The deployment uses a separate demonstration database. It is not connected to VELoop's production database.

## Technology stack

- **Frontend:** React, Vite, React Router, Axios
- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JSON Web Tokens (JWT), bcryptjs password hashing
- **Security controls:** role-based authorization, input validation, rate limiting, idempotency and MongoDB transactions
- **Deployment:** Vercel (frontend), Render (backend), MongoDB Atlas (database)

## Main capabilities

- The backend wallet model tracks VEs, SVEs, Gems, Tokens and Spins. The current user-facing wallet endpoint returns the VES balance used by the demonstrated redemption flow.
- Wallet transaction history records credits and debits with before/after balances, source, status and timestamps.
- Payout methods and voucher denominations are served from MongoDB rather than defined as wallet business rules in React.
- UPI withdrawal requests validate the selected method and option on the server, validate the UPI ID, check the user's account status and verify the VES balance.
- A successful withdrawal request immediately deducts VES, creates a withdrawal record and creates a matching debit ledger entry in a MongoDB transaction.
- Users can view their own withdrawal history and cancel an eligible pending request.
- Administrators can review users, wallets, withdrawals, transactions and audit logs; process, approve or reject withdrawals; adjust wallet balances; inspect reconciliation; and update payout method configuration.
- Sensitive administrative actions create audit records.
- Repeated withdrawal attempts can be flagged for additional review.

## Repository structure

```text
veloop-wallet-system/
├── backend/
│   ├── seed/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── pages/
│   │   └── ...
│   ├── package.json
│   └── .env.example
├── README.md
├── API_DOCUMENTATION.md
├── DATABASE_DOCUMENTATION.md
├── ARCHITECTURE.md
└── TEST_REPORT.md
```

## Local setup

### Prerequisites

- Node.js and npm
- A MongoDB database. MongoDB Atlas is suitable. The application uses MongoDB transactions, so the deployment must support replica-set transactions.
- Git

### 1. Clone the repository

```bash
git clone https://github.com/sumaiya01naaz-debug/veloop-wallet-system.git
cd veloop-wallet-system
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and provide environment-specific values:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/veloop_wallet
JWT_SECRET=<long-random-secret>
DEMO_USER_PASSWORD=<demo-password-used-by-seed-workflow>
CLIENT_URL=http://localhost:5173
```

Use your own MongoDB connection string and a long, random JWT secret. Do not commit `.env`.

Start the backend from the `backend` directory:

```bash
node server.js
```

The API is available at `http://localhost:5000`. The root endpoint returns a simple backend-running message.

### 3. Configure the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the Vite development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

### 4. Demo users and seed data

Use the repository's seed workflow to create demonstration users, wallets and payout configuration. Set the demo password through the local environment rather than hardcoding it in source control. A user must exist and be active to log in. For the administrative demonstration, the intended demo account must have the `ADMIN` role; ordinary demo accounts should remain `USER`.

Do not publish demo passwords, JWT values, MongoDB credentials or private payout details in this README, Postman collection or GitHub repository.

## Main user workflow

1. Sign in and receive a JWT.
2. The frontend requests the authenticated user's wallet and recent ledger transactions.
3. The user opens the payout page. Payout methods and UPI voucher options are fetched from the API.
4. The user selects an available voucher and enters a UPI ID.
5. The frontend submits the method, option ID, payout details and an idempotency key. The backend obtains the actual redemption value from MongoDB; it does not trust a client-supplied VES amount.
6. The backend validates the request and atomically debits VES, creates a `PENDING` withdrawal, creates a debit ledger record and writes an audit event.
7. The user can view the withdrawal history. An administrator can move a request to processing, approve it or reject it. Rejection and eligible cancellation refund VES through a separate credit ledger entry.

## Supported payout scope

The current withdrawal service is configured to process **UPI** withdrawals. Other methods may be present in the payout-method collection for display, but Amazon Pay, Google Play and PayPal should not be described as operational payout integrations. The backend withdrawal service currently rejects methods other than UPI. Availability shown by the API is controlled by the database configuration.

The currently configured UPI voucher values observed during project testing were:

| Payout value | Required VES |
|---:|---:|
| ₹10 | 2,400 |
| ₹50 | 10,000 |
| ₹100 | 19,500 |
| ₹500 | 80,500 |
| ₹1,000 | 150,000 |

The database payout option is authoritative. The table above is a snapshot of the demonstration configuration, not a frontend rule.

## Security and consistency

- Protected endpoints require `Authorization: Bearer <JWT>`.
- The authenticated user's ID is taken from the verified token and current database user record, not from a caller-supplied wallet owner ID.
- Administrative endpoints require an active account with the `ADMIN` role.
- Withdrawal and wallet mutation routes have rate limits.
- Withdrawal requests use an idempotency key with a unique per-user index.
- Balance debits use a conditional atomic update that requires sufficient balance.
- Withdrawal creation, wallet mutation, ledger creation and related audit writes use MongoDB transactions where implemented.
- Rejected withdrawals and eligible cancellations create refund ledger records.
- Wallet and administrative mutations are auditable.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md) and [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for details.

## Testing

The project was tested with wallet credit/debit operations, withdrawal creation and status transitions, insufficient-balance rejection, cancellation and rejection refunds, suspicious-activity review, administrative corrections, payout configuration changes and reconciliation. See [TEST_REPORT.md](TEST_REPORT.md) for the results and the limitations that remain explicitly documented.

## Scaling from 1,000 to 1,000,000 users

The current implementation establishes the basic correctness controls: atomic balance updates, MongoDB transactions, unique idempotency keys, query indexes, audit records and rate limiting. At much larger scale, I would:

1. Keep the ledger append-oriented and preserve wallet mutations behind a small set of transactional services.
2. Use a managed MongoDB replica set or sharded deployment after workload and shard-key analysis; review transaction size and duration.
3. Add a durable queue for asynchronous payout-provider calls, retries, reconciliation jobs and notifications. Use an outbox pattern so a committed withdrawal and its downstream event cannot diverge.
4. Make provider callbacks and background jobs idempotent; retain provider references and explicit settlement states.
5. Use Redis-backed distributed rate limiting and short-lived caching for non-financial reads. Cached balances must never authorize a debit.
6. Add metrics, structured logs, tracing, alerts and scheduled reconciliation with an operational exception queue.
7. Review indexes using production query plans, archive older audit/ledger data according to retention policy and load-test concurrent withdrawal traffic.
8. Expand fraud detection into a dedicated risk-scoring capability. Evaluate request frequency, unusual withdrawal amounts, repeated payout destinations and suspicious account/device activity. Route high-risk requests to manual review, retain the risk reason in audit records, and tune thresholds using observed fraud patterns. The current implementation provides basic repeated-withdrawal detection; the broader scoring capability is a proposed scale-up improvement.

These are proposed scale-up improvements, not features claimed as already implemented.

## Documentation

- [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- [DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [TEST_REPORT.md](TEST_REPORT.md)

## Important demo limitation

A withdrawal marked `APPROVED` represents an administrator-reviewed state in this demonstration. It does not, by itself, prove that a real bank transfer or third-party payout provider has been integrated. Production payout execution would require an authorized provider integration, callback verification, settlement reconciliation and operational controls.
