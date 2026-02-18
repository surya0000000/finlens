# FinLens X Backend

Production-style backend for **FinLens X**, a read-only personal finance intelligence platform with:

- Secure account linking via **Plaid** (Sandbox/Dev/Prod environments)
- Transaction ingestion and sync via `transactions/sync` cursors
- Unified account + dashboard APIs
- Subscription detection and cancellation simulation
- AI advisor endpoint (OpenAI optional, deterministic fallback built in)
- Privacy-first token handling (AES-256-GCM encrypted Plaid access tokens)

---

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **API:** Express 5
- **DB/ORM:** Prisma + SQLite (easy local dev)
- **Auth:** JWT (email/password)
- **Integrations:** Plaid, OpenAI (optional)

---

## Implemented Product Capabilities

### 1) Authentication & User Identity
- Register/login with hashed passwords
- JWT-protected API routes
- `/auth/me` profile endpoint

### 2) Plaid Integration (Read-Only)
- Create Link token for frontend Plaid Link flow
- Exchange public token for access token
- Encrypt access token before storage
- List linked Plaid items
- On-demand sync (single item or all)
- Sandbox helper endpoint to generate a sandbox public token quickly

### 3) Financial Data Layer
- Upsert Plaid accounts and balances
- Persist normalized transactions with categories and merchant metadata
- Handle incremental sync adds/modifies/removals

### 4) FinLens Intelligence APIs
- Unified dashboard (net worth, cash flow, utilization, categories)
- Subscription detection (recurrence + confidence score)
- Subscription cancellation simulation
- Insight generation
- Conversational advisor API (AI + fallback rules)

---

## Project Structure

```text
src/
  app.ts
  index.ts
  config/
    env.ts
  lib/
    prisma.ts
  middleware/
    auth.ts
    error.ts
  routes/
    authRoutes.ts
    plaidRoutes.ts
    financeRoutes.ts
    advisorRoutes.ts
    healthRoutes.ts
    index.ts
  services/
    authService.ts
    plaidClient.ts
    plaidService.ts
    transactionSyncService.ts
    dashboardService.ts
    subscriptionService.ts
    insightService.ts
    advisorService.ts
  utils/
    crypto.ts
    date.ts
    math.ts
    httpError.ts
prisma/
  schema.prisma
```

---

## Environment Configuration

Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

Required fields:

- `DATABASE_URL`
- `JWT_SECRET` (>= 32 chars)
- `TOKEN_ENCRYPTION_KEY` (64 hex chars / 32 bytes)
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV` (`sandbox`, `development`, `production`)

Optional:

- `OPENAI_API_KEY` (enables LLM-backed advisor responses)

---

## Local Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Health check:

```bash
curl http://localhost:4000/api/v1/health
```

---

## API Base URL

`/api/v1`

---

## API Endpoints

### Health
- `GET /health`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (Bearer token required)

### Plaid
- `POST /plaid/link-token`
- `POST /plaid/exchange-public-token`
- `GET /plaid/items`
- `POST /plaid/sync`
- `POST /plaid/sandbox/public-token`

### Finance
- `GET /finance/accounts`
- `GET /finance/transactions`
- `GET /finance/dashboard`
- `GET /finance/subscriptions`
- `POST /finance/subscriptions/simulate-cancel`
- `GET /finance/insights`

### Advisor
- `POST /advisor/query`

---

## End-to-End Sandbox Flow (No Frontend Required)

### 1) Register
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"demo@finlens.ai",
    "password":"SuperStrongPassword123!",
    "firstName":"Demo",
    "lastName":"User"
  }'
```

Save the returned JWT as `TOKEN`.

### 2) Create Plaid sandbox public token
```bash
curl -X POST http://localhost:4000/api/v1/plaid/sandbox/public-token \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"institutionId":"ins_109508"}'
```

Save `publicToken`.

### 3) Exchange and auto-sync
```bash
curl -X POST http://localhost:4000/api/v1/plaid/exchange-public-token \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"publicToken":"PUBLIC_TOKEN_HERE"}'
```

### 4) Pull dashboard + insights
```bash
curl http://localhost:4000/api/v1/finance/dashboard \
  -H "Authorization: Bearer TOKEN"

curl http://localhost:4000/api/v1/finance/insights \
  -H "Authorization: Bearer TOKEN"
```

### 5) Ask advisor
```bash
curl -X POST http://localhost:4000/api/v1/advisor/query \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"Can I reduce monthly spend by 10%?"}'
```

---

## Security & Privacy Notes

- Read-only design: no money movement, no payment execution.
- Plaid access tokens are encrypted at rest using AES-256-GCM.
- JWT authentication protects user-scoped data.
- Rate limiting and secure headers are enabled by default.

---

## Important Product Assumptions

- This backend currently uses SQLite for local simplicity.
- For production use, migrate to Postgres and introduce managed secrets, centralized logging, and observability.
- AI advisor is intentionally non-custodial and non-executional.
