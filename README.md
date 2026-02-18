# FinLens X (Full Stack)

FinLens X is now a deployable full-stack MVP:

- **Backend API** (Express + TypeScript + Prisma + Plaid)
- **Web app** (React + Vite + React Query + Recharts + Plaid Link)
- **Dockerized deployment** (backend + frontend)
- **CI workflow** (backend build + frontend build)

This is a privacy-first, read-only financial intelligence platform with actionable insights.

---

## What is included

### Backend
- JWT auth (`register`, `login`, `me`)
- Plaid integration (`link-token`, token exchange, sync, list items)
- Transaction ingestion and normalization
- Dashboard metrics (net worth, cash flow, utilization, categories)
- Subscription detection + cancellation simulation
- Insight engine (explainable cards)
- Advisor endpoint (OpenAI when configured, deterministic fallback otherwise)
- Demo data endpoint to make the product usable before live linking
- Health and readiness endpoints

### Frontend
- Authentication flow (register/login)
- Dashboard with KPI cards + charts
- Plaid connect (live link flow + sandbox quick connect)
- Accounts and transaction explorer
- Subscription analysis and savings simulation
- Insights page
- Advisor chat page
- Responsive layout and polished UI

### Deployment assets
- Backend `Dockerfile`
- Frontend `web/Dockerfile` + Nginx config
- `docker-compose.yml` for one-command deployment
- GitHub Actions CI (`.github/workflows/ci.yml`)

---

## Repository structure

```text
.
├─ src/                   # Backend source
├─ prisma/                # Prisma schema + migrations
├─ web/                   # Frontend React app
├─ Dockerfile             # Backend container
├─ docker-compose.yml     # Full-stack compose deployment
└─ .github/workflows/ci.yml
```

---

## Prerequisites

- Node.js 22+
- npm 10+
- Plaid credentials (Sandbox recommended for development)
- Optional: OpenAI API key

---

## Environment setup

### Backend

```bash
cp .env.example .env
```

Required backend variables:

- `DATABASE_URL`
- `JWT_SECRET` (>= 32 chars)
- `TOKEN_ENCRYPTION_KEY` (64 hex chars / 32 bytes)
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV`

### Frontend

```bash
cp web/.env.example web/.env
```

Default:
- `VITE_API_BASE_URL=http://localhost:4000/api/v1`

---

## Run locally (full stack)

Install dependencies:

```bash
npm install
npm --prefix web install
```

Prepare Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

Run backend + web together:

```bash
npm run dev:full
```

Apps:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000/api/v1`

---

## Run with Docker (deployment mode)

```bash
docker compose up --build
```

Services:
- Web app: `http://localhost:8080`
- Backend API: `http://localhost:4000/api/v1`

---

## Key API endpoints

Base: `/api/v1`

### Health
- `GET /health`
- `GET /health/ready`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

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
- `POST /finance/demo-seed`

### Advisor
- `POST /advisor/query`

---

## Demo-first workflow

If you want immediate UI data without linking real institutions:

1. Register/login in the web app
2. Open **Dashboard**
3. Click **Load demo financial dataset**

This seeds realistic accounts + transactions for testing charts, subscriptions, and advisor flows.

---

## Security and privacy

- Read-only data model (no transfers/payments)
- Plaid access tokens encrypted at rest (AES-256-GCM)
- JWT-protected APIs
- CORS allow-list support
- Rate limiting + security headers
- Explainable advisor responses with citations

---

## CI

CI runs on push/PR:

- Backend install + Prisma generate + TypeScript build
- Frontend install + Vite build

---

## Production hardening checklist (recommended next)

- Move from SQLite to managed PostgreSQL
- Add structured logging + tracing (OpenTelemetry)
- Add API and E2E tests
- Add secrets manager integration
- Add domain + HTTPS + reverse proxy with single-origin routing
- Add webhook handler for Plaid updates

