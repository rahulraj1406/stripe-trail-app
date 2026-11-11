require('dotenv').config();
const path = require('path');
const express = require('express');
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
const BASE_URL = process.env.BASE_URL || 'http://localhost:4242';
const PORT = process.env.PORT || 4242;
for (const [k, v] of Object.entries({ STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY })) {
  if (!v) { console.error(`Missing env var ${k} (see .env.example)`); process.exit(1); }
}

const stripe = Stripe(STRIPE_SECRET_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = express();

// Webhook needs the raw body for signature verification – register before express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET not set');
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook error:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const { error } = await supabase.from('entries').upsert(
      [{ session_id: s.id, email: s.customer_details?.email || null, amount_cents: s.amount_total, paid_at: new Date().toISOString() }],
      { onConflict: 'session_id' }
    );
    if (error) console.error('Supabase entry error:', error.message);
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: { currency: 'usd', product_data: { name: 'Weekly Trail Challenge' }, unit_amount: 500 },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: req.body?.email || undefined,
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/cancel`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/record-run', async (req, res) => {
  const { user, distanceKm, date } = req.body || {};
  const km = Number(distanceKm);
  if (!user || !Number.isFinite(km) || km <= 0) {
    return res.status(400).json({ error: 'user and a positive distanceKm required' });
  }
  const { data, error } = await supabase
    .from('runs')
    .insert([{ user, distance_km: km, recorded_at: date || new Date().toISOString() }])
    .select();
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({ message: 'Run recorded', record: data });
});

app.get('/leaderboard', async (req, res) => {
  const { data, error } = await supabase.from('runs').select('user, distance_km');
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  const totals = {};
  for (const r of data) totals[r.user] = (totals[r.user] || 0) + Number(r.distance_km);
  const leaderboard = Object.entries(totals)
    .map(([user, total_km]) => ({ user, total_km }))
    .sort((a, b) => b.total_km - a.total_km)
    .slice(0, 20);
  res.json({ leaderboard });
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/success', (req, res) => res.send('<body style="font-family:system-ui;text-align:center;padding:4rem"><h1 style="color:#222">✅ You’re in!</h1><p>Payment received.</p><a href="/" style="color:#ff385c;font-weight:600">Back to challenge</a>'));
app.get('/cancel', (req, res) => res.send('<h1>❌ Payment cancelled.</h1><a href="/">Back</a>'));

if (require.main === module) app.listen(PORT, () => console.log(`🚀 Server listening on ${BASE_URL}`));
module.exports = app;
