const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nzdodkjluxxquconnflu.supabase.co';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const adminSb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userErr } = await adminSb.auth.getUser(token);
  if (userErr || !user) return res.status(401).json({ error: 'Invalid session' });

  const plan = req.body?.plan === 'yearly' ? 'yearly' : 'monthly';
  const priceId = plan === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
  if (!priceId) return res.status(500).json({ error: 'Pricing not configured' });

  const origin = req.headers.origin || `https://${req.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id, plan },
      success_url: `${origin}/?subscribed=1`,
      cancel_url: `${origin}/?canceled=1`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    return res.status(500).json({ error: 'Could not create checkout session' });
  }
};
