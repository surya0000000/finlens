# FinLens

A privacy-first personal finance intelligence platform. Connect your bank accounts via Plaid, get real-time insights on your spending, subscriptions, and cash flow, and ask an AI advisor questions about your finances in plain English.

**Live app:** https://web-sage-eta-29.vercel.app
**Backend API:** https://finlens-backend-pi78.onrender.com/api/v1/health

---

## What it does

- Connects to your bank accounts read-only via Plaid (sandbox or live)
- Ingests and normalises transactions automatically
- Computes net worth, cash flow, spending by category, credit utilisation
- Detects recurring subscriptions and simulates cancellation savings
- Generates explainable insight cards (e.g. "Your dining spend is up 40% vs last month")
- Provides a conversational AI advisor powered by OpenAI that answers questions using your real financial data
- Falls back to a deterministic rule engine if OpenAI is unavailable

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│   React + Vite + React Query + Recharts + Plaid Link        │
│   Deployed → Vercel                                         │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS (VITE_API_BASE_URL)
┌───────────────────────▼─────────────────────────────────────┐
│                    Express API                              │
│   TypeScript · JWT auth · Zod validation · Rate limiting   │
│   Deployed → Render (Node runtime)                         │
└──────┬──────────────────┬───────────────────────┬──────────┘
       │                  │                       │
┌──────▼──────┐   ┌───────▼──────┐   ┌───────────▼──────────┐
│   Prisma    │   │    Plaid     │   │       OpenAI          │
│   SQLite    │   │   Sandbox /  │   │   gpt-4o-mini         │
│   (prod.db) │   │    Live API  │   │   Advisor endpoint    │
└─────────────┘   └──────────────┘   └──────────────────────┘
```

### Backend layers

| Layer | Tech | Purpose |
|-------|------|---------|
| HTTP | Express 5 + TypeScript | Routing, middleware, error handling |
| Auth | JWT + bcrypt | Register, login, protected routes |
| Database | Prisma + SQLite | Users, accounts, transactions, Plaid items |
| Plaid | Plaid Node SDK | Link tokens, token exchange, transaction sync |
| Encryption | AES-256-GCM | Plaid access tokens encrypted at rest |
| AI | OpenAI SDK | Conversational advisor with financial context |
| Insights | Rule engine | Deterministic insight cards + advisor fallback |

### Frontend layers

| Layer | Tech | Purpose |
|-------|------|---------|
| Framework | React 18 + Vite | SPA with fast HMR in dev |
| Data fetching | TanStack Query | Server state, caching, background refetch |
| Charts | Recharts | Bar charts, category breakdowns |
| Plaid | react-plaid-link | Embedded bank connection flow |
| Styling | CSS custom properties | Design tokens, responsive layout |

### Data flow

```
User connects bank
  → Plaid Link (frontend) → /plaid/exchange-public-token (backend)
  → Access token encrypted + stored in DB
  → /plaid/sync called → transactions ingested + normalised
  → Dashboard, insights, subscriptions computed on demand from DB

User asks advisor a question
  → POST /advisor/query { question }
  → Backend fetches dashboard summary + subscriptions + insights in parallel
  → Formats as human-readable context block
  → Sends to OpenAI with conversational system prompt
  → Returns { answer, citations, actions, generatedBy }
```

---

## Repository structure

```
finlens/
├── src/                          # Backend
│   ├── config/env.ts             # Zod-validated env config
│   ├── middleware/
│   │   ├── auth.ts               # JWT verification middleware
│   │   └── error.ts              # Global error handler
│   ├── routes/
│   │   ├── advisorRoutes.ts      # POST /advisor/query
│   │   ├── authRoutes.ts         # register / login / me
│   │   ├── financeRoutes.ts      # dashboard / transactions / insights
│   │   ├── healthRoutes.ts       # health / ready
│   │   └── plaidRoutes.ts        # Plaid link + sync
│   ├── services/
│   │   ├── advisorService.ts     # OpenAI advisor + rule fallback
│   │   ├── authService.ts        # JWT + bcrypt
│   │   ├── dashboardService.ts   # Net worth, cash flow, categories
│   │   ├── demoDataService.ts    # Seed realistic demo transactions
│   │   ├── insightService.ts     # Explainable insight cards
│   │   ├── plaidService.ts       # Plaid API calls
│   │   ├── subscriptionService.ts # Recurring charge detection
│   │   └── transactionSyncService.ts # Plaid cursor-based sync
│   └── utils/
│       ├── crypto.ts             # AES-256-GCM encrypt/decrypt
│       ├── date.ts               # Month boundary helpers
│       ├── math.ts               # Rounding utilities
│       └── httpError.ts          # Typed HTTP errors
├── prisma/
│   └── schema.prisma             # User, PlaidItem, Account, Transaction
├── web/                          # Frontend
│   └── src/
│       ├── components/
│       │   ├── AICopilotPanel.tsx  # Slide-in AI chat panel
│       │   ├── AppShell.tsx        # Nav + layout wrapper
│       │   ├── PlaidConnectCard.tsx # Bank connection UI
│       │   └── ...
│       ├── pages/
│       │   ├── DashboardPage.tsx   # KPI cards + charts
│       │   ├── AccountsPage.tsx    # Account list + transactions
│       │   ├── InsightsPage.tsx    # Insight cards
│       │   ├── AdvisorPage.tsx     # Full-page advisor chat
│       │   └── SubscriptionsPage.tsx
│       ├── context/AuthContext.tsx # JWT storage + auth state
│       └── lib/
│           ├── api.ts              # Axios instance + auth interceptor
│           └── format.ts           # Currency / date formatters
├── Dockerfile                    # Backend container
├── docker-compose.yml            # Full-stack local deployment
├── render.yaml                   # Render.com deployment config
└── .env.example                  # Environment variable template
```

---

## Running locally

### Prerequisites

- Node.js 22+
- npm 10+
- Plaid account (free sandbox at dashboard.plaid.com)
- OpenAI API key (optional — advisor falls back to rule engine without it)

### Backend

```bash
cp .env.example .env
# Fill in JWT_SECRET, TOKEN_ENCRYPTION_KEY, PLAID_CLIENT_ID, PLAID_SECRET

npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
# → http://localhost:4000/api/v1
```

### Frontend

```bash
cd web
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:4000/api/v1

npm install
npm run dev
# → http://localhost:5173
```

### Both together

```bash
npm run dev:full
```

### Docker (production mode locally)

```bash
docker compose up --build
# Frontend → http://localhost:8080
# Backend  → http://localhost:4000/api/v1
```

---

## Environment variables

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | yes | `development` or `production` |
| `PORT` | yes | API port (default `4000`) |
| `DATABASE_URL` | yes | `file:./prisma/dev.db` for SQLite |
| `JWT_SECRET` | yes | Min 32 chars — sign with `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | yes | Token lifetime e.g. `7d` |
| `TOKEN_ENCRYPTION_KEY` | yes | 64 hex chars — generate with `openssl rand -hex 32` |
| `CORS_ORIGIN` | yes | Comma-separated allowed origins |
| `PLAID_CLIENT_ID` | yes | From Plaid dashboard |
| `PLAID_SECRET` | yes | From Plaid dashboard |
| `PLAID_ENV` | yes | `sandbox`, `development`, or `production` |
| `PLAID_PRODUCTS` | yes | `transactions` |
| `PLAID_COUNTRY_CODES` | yes | `US` |
| `OPENAI_API_KEY` | no | Enables AI advisor; rule engine used if absent |
| `OPENAI_MODEL` | no | Defaults to `gpt-4o-mini` |

### Frontend (`web/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API base URL |

---

## API reference

Base path: `/api/v1`

### Health
```
GET  /health          → { status, service, timestamp }
GET  /health/ready    → 200 when DB is reachable
```

### Auth
```
POST /auth/register   → { token, user }
POST /auth/login      → { token, user }
GET  /auth/me         → { user }          (JWT required)
```

### Plaid
```
POST /plaid/link-token                    → { link_token }
POST /plaid/exchange-public-token         → { itemId }
GET  /plaid/items                         → PlaidItem[]
POST /plaid/sync                          → { added, modified, removed }
POST /plaid/sandbox/public-token          → { public_token }  (sandbox only)
```

### Finance
```
GET  /finance/dashboard                   → DashboardSummary
GET  /finance/accounts                    → Account[]
GET  /finance/transactions                → Transaction[] (paginated)
GET  /finance/subscriptions               → Subscription[]
POST /finance/subscriptions/simulate-cancel → { monthlySavings, annualSavings }
GET  /finance/insights                    → InsightCard[]
POST /finance/demo-seed                   → seeds demo data
```

### Advisor
```
POST /advisor/query   { question: string } → { answer, citations, actions, generatedBy }
```

---

## How to use the app

### First time setup

1. Go to https://web-sage-eta-29.vercel.app
2. Click **Register** and create an account
3. You'll land on the Dashboard

### Connect a bank (sandbox)

1. Click **Connect Bank Account**
2. Use the Plaid sandbox — search for any institution (e.g. "Chase")
3. Use credentials: `user_good` / `pass_good`
4. Transactions sync automatically after connection

### Or load demo data instantly

1. On the Dashboard, click **Load demo financial dataset**
2. This seeds realistic accounts and 90 days of transactions
3. All features — charts, subscriptions, insights, advisor — work immediately

### AI Advisor

1. Go to **Advisor** in the nav, or click the AI icon in the header
2. Ask anything in plain English:
   - "Can I afford a $2,000 vacation next month?"
   - "What are my biggest spending categories?"
   - "How can I reduce my monthly outflow by 10%?"
   - "Do I have any subscriptions I'm not using?"
3. The advisor uses your actual synced financial data to answer

---

## Deployment

### Current production setup

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | https://web-sage-eta-29.vercel.app |
| Backend | Render (free tier) | https://finlens-backend-pi78.onrender.com |

### Deploy your own

**Backend → Render**

1. Fork this repo
2. Create a new Web Service on render.com pointing to your fork
3. Render auto-detects `render.yaml`
4. Add all required env vars in the Render dashboard
5. Deploy

**Frontend → Vercel**

```bash
cd web
vercel --prod
# Set VITE_API_BASE_URL to your Render backend URL
vercel env add VITE_API_BASE_URL production
vercel --prod
```

Then update `CORS_ORIGIN` on Render to match your Vercel URL.

---

## Security model

- All Plaid access tokens are encrypted at rest using AES-256-GCM before being stored in the database
- The encryption key (`TOKEN_ENCRYPTION_KEY`) is never stored in the database — only in environment variables
- All finance endpoints require a valid JWT — no data is publicly accessible
- The app is strictly read-only — no transfers, payments, or writes back to Plaid
- CORS is locked to explicit origins in production
- Rate limiting and security headers (Helmet) are applied to all routes

---

## Production hardening (recommended next steps)

- Migrate from SQLite to managed PostgreSQL (Render, Supabase, or Neon) for persistent storage
- Add Plaid webhooks to sync transactions automatically instead of on-demand
- Add structured logging with OpenTelemetry or Datadog
- Add API tests (Vitest) and E2E tests (Playwright)
- Set up a custom domain with HTTPS
- Add a secrets manager (AWS Secrets Manager, Doppler) instead of raw env vars
