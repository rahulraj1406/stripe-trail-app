# Stripe Trail App
Weekly Trail Challenge: pay a $5 entry via Stripe Checkout, log runs to Supabase, view a leaderboard.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in values.
3. Run `schema.sql` in the Supabase SQL editor.
4. `npm start` → http://localhost:4242
5. Webhook: `stripe listen --forward-to localhost:4242/webhook`, put the printed `whsec_...` in `STRIPE_WEBHOOK_SECRET`.

Test card: `4242 4242 4242 4242`, any future expiry/CVC.

Endpoints: `POST /create-checkout-session`, `POST /record-run`, `GET /leaderboard`, `POST /webhook`, `GET /health`.
