# FinLens Web App

Frontend for FinLens (React + TypeScript + Vite).

## Local

```bash
npm install
cp .env.example .env
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to Vercel

This folder is pre-configured with `vercel.json` for SPA routing and Vite output.

### One-time setup

```bash
npm i -g vercel
vercel login
```

### Deploy

Run from the **web** directory:

```bash
vercel
```

For production:

```bash
vercel --prod
```

### Required Vercel env var

Set in Vercel Project → Settings → Environment Variables:

- `VITE_API_BASE_URL` = your backend URL, e.g.  
  `https://your-backend-domain.com/api/v1`
