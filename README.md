# Looply — Campus Commerce POC

Pay at campus stores with a wallet, record a voice review, earn 5% off. Student app and vendor dashboard.

**Stack:** Vite + React + TypeScript, Supabase (Postgres, RPC, Storage), hosted on Vercel. All on free tiers.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
```

## Backend
Run `supabase/schema.sql`, then `supabase/seed.sql`, then `supabase/002_accounts_vendor_tools.sql` (the migration moves vendor
login from PIN to email + password and adds SKUs, transcripts and sentiment).
Only stores and menus are readable by the browser. Everything else goes through security-definer RPCs that check a session token.

## Features
- Student sign up: only `@iimb.ac.in` emails are accepted and marked verified automatically (domain check; no inbox verification).
- Vendor sign up: owner details, store setup and starting SKUs. Dashboard: orders, products (add, edit, SKU, stock, hide, delete), voice insights, store settings.
- Voice review: live transcript (browser speech recognition), editable before sending, with sentiment and per-topic analysis (`src/sentiment.ts`).

## Demo logins (password `looply123`)
- Student: `durgesh@iimb.ac.in` (or ID `PGP2026-114`)
- Vendors: `hgs@looply.demo`, `snc@looply.demo`, `aml@looply.demo`, `mrs@looply.demo`, `gmc@looply.demo`, `juc@looply.demo`

Demo data only. Wallet top-ups are simulated.
