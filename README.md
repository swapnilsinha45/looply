# Looply — Campus Commerce POC

Pay at campus stores with a wallet, speak a short review in any language, and earn rewards. Student app and vendor dashboard (phone view plus a desktop console).

**Stack:** Vite + React + TypeScript, Supabase (Postgres, RPC, Storage, Edge Functions), Vercel. All on free tiers.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
```

## Backend
Run the SQL in `supabase/` in order: `schema.sql`, `seed.sql`, `002_…`, `004_…`, then the rewards migration (`005_…` describes it).
Only stores and menus are readable by the browser. Everything else goes through security-definer RPCs that check a session token.

Edge functions (`supabase/functions/`, deployed with `verify_jwt` off; they check the Looply session token themselves):
- `transcribe`: Groq Whisper, automatic language detection, never translates.
- `analyze`: Groq `gpt-oss` LLM for aspect-based sentiment, category, severity, issue tags and an English summary for the vendor.
  Needs a row in `app_secrets` named `groq_api_key`. Falls back to the offline word-list engine in `src/sentiment.ts`.

## Features
- **Students:** sign up with an `@iimb.ac.in` email (domain check, no inbox verification), wallet with a demo payment gateway, favourites on Home with one-tap reorder, cart with coupons.
- **Rewards (hero):** every voice note earns a scratch card (coupon or cashback), every 5th unlocks 5% off, and tiers (Silver at 5 notes: 2% cashback, Gold at 15: 3%). Coupons can be percent off, flat off, flat cashback or percent cashback, with minimum order, caps, store restrictions and expiry. All rules run on the server in `place_order`.
- **Voice review:** record once, text appears in the language spoken (editable before sending), then analysed by the AI.
- **Vendors:** phone dashboard by default with a button to the desktop console. Active orders (done ones leave), products and SKUs, inventory, "Needs attention" bad reviews with severity and issue tags, sentiment by product, theme, hour and day, rewards cost.

## Demo logins (password `looply123`)
- Student: `durgesh@iimb.ac.in` (or ID `PGP2026-114`)
- Vendors: `hgs@looply.demo`, `snc@looply.demo`, `aml@looply.demo`, `mrs@looply.demo`, `gmc@looply.demo`, `juc@looply.demo`

Demo data only. The payment gateway is a simulation; no real money moves.
