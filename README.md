# Looply — Campus Commerce POC

Pay at campus stores with a wallet, record a 15-second voice note, earn 5% off. Student app and vendor dashboard.

**Stack:** Vite + React + TypeScript, Supabase (Postgres, RPC, Storage), hosted on Vercel. All on free tiers.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
```

## Backend
 then  create tables, RLS and RPCs.  adds six stores, menus and demo logins
(seed.sql predates the migration; the migration re-keys demo vendors to email logins).
Only stores and menus are readable by the browser. Everything else goes through security-definer RPCs that check a session token.

## Features
- Student sign up: only  emails are accepted and verified automatically (domain check, no inbox verification).
- Vendor sign up: owner details, store setup and starting SKUs. Dashboard: orders, products (add / edit / SKU / stock / hide / delete), voice insights, store settings.
- Voice review: live transcript (browser speech recognition), editable before sending, with sentiment and per-topic analysis ().

## Demo logins
- Student:  (or ) / - Vendors: , , , , ,  / 
Demo data only. Wallet top-ups are simulated.
