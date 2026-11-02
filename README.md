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
`supabase/schema.sql` creates tables, RLS and RPCs. `supabase/seed.sql` adds six stores, menus and demo logins.
Tables are not readable by the browser except stores and menus. Everything else goes through
security-definer RPCs that check a session token.

## Demo logins
- Student: `PGP2026-114` / `looply123`
- Vendor: any store, PIN `1234`

Demo data only. Wallet top-ups are simulated.
