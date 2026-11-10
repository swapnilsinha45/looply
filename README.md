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
Run the SQL in `supabase/` in order: `schema.sql`, `seed.sql`, `002_…`, `004_…`, then `005_…` and `006_…` (these two describe migrations applied through the Supabase migration history).
Only stores and menus are readable by the browser. Everything else goes through security-definer RPCs that check a session token.

Edge functions (`supabase/functions/`, deployed with `verify_jwt` off; they check the Looply session token themselves):
- `transcribe`: Groq Whisper, automatic language detection, never translates.
- `analyze`: Groq `gpt-oss` LLM for aspect-based sentiment, category, severity, issue tags and an English summary for the vendor.
  Needs a row in `app_secrets` named `groq_api_key`. Falls back to the offline word-list engine in `src/sentiment.ts`.

## Features
- **Students:** sign up with an `@iimb.ac.in` email (domain check, no inbox verification), wallet with a demo payment gateway, favourites on Home with one-tap reorder, cart with coupons.
- **Consent first:** nothing is recorded or analysed until the student agrees once (Rewards > Feedback is on). Audio is never stored; only the text is kept. The student can turn feedback off any time.
- **One reward rule:** keep feedback on and order 3 times in a calendar month to earn that month's perk (a scratch card with a coupon or cashback). Nobody is paid per note, so feedback is not bought by the unit. Coupons and cashback have reachable minimums (₹40 to ₹50).
- **Voice feedback:** record once, text appears in the language spoken (editable before sending), then analysed by the AI.
- **Anonymous to vendors:** stores see "Student", the words, the mood and tags. Never names, audio, order numbers, exact times, or a link between an order and its feedback (enforced in the database).
- **Vendors:** phone dashboard by default with a button to the desktop console. Active orders, products and SKUs, inventory, "Needs attention" bad reviews with severity and issue tags, translate and ignore on every review, an "Actionable feedback" metric (specific, usable notes rather than volume), sentiment by product, theme, hour and day.

## Demo logins (password `looply123`)
- Student: `durgesh@iimb.ac.in` (or ID `PGP2026-114`)
- Vendors: `hgs@looply.demo`, `snc@looply.demo`, `aml@looply.demo`, `mrs@looply.demo`, `gmc@looply.demo`, `juc@looply.demo`

Demo data only. The payment gateway is a simulation; no real money moves.
