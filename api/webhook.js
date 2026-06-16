const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nzdodkjluxxquconnflu.supabase.co';

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function findUserByEmail(adminSb, email) {
  let page = 1;
  while (true) {
    const { data: { users }, error } = await adminSb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !users?.length) return null;
    const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < 1000) return null;
    page++;
  }
}

async function findUserByCustomerId(adminSb, customerId) {
  let page = 1;
  while (true) {
    const { data: { users }, error } = await adminSb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !users?.length) return null;
    const found = users.find(u => u.app_metadata?.stripe_customer_id === customerId);
    if (found) return found;
    if (users.length < 1000) return null;
    page++;
  }
}

async function setStatus(adminSb, userId, status, customerId) {
  const meta = { subscription_status: status };
  if (customerId) meta.stripe_customer_id = customerId;
  await adminSb.auth.admin.updateUserById(userId, { app_metadata: meta });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const adminSb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const obj = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const customerId = obj.customer;
        const supabaseUserId = obj.client_reference_id || obj.metadata?.supabase_user_id;
        if (supabaseUserId) {
          await setStatus(adminSb, supabaseUserId, 'active', customerId);
          break;
        }
        const email = obj.customer_details?.email;
        if (!email) break;
        const user = await findUserByEmail(adminSb, email);
        if (user) await setStatus(adminSb, user.id, 'active', customerId);
        break;
      }
      case 'invoice.payment_succeeded': {
        const customerId = obj.customer;
        const email = obj.customer_email;
        let user = await findUserByCustomerId(adminSb, customerId);
        if (!user && email) user = await findUserByEmail(adminSb, email);
        if (user) await setStatus(adminSb, user.id, 'active', customerId);
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const user = await findUserByCustomerId(adminSb, obj.customer);
        if (user) await setStatus(adminSb, user.id, 'inactive', null);
        break;
      }
      case 'invoice.payment_failed': {
        const customerId = obj.customer;
        const email = obj.customer_email;
        let user = await findUserByCustomerId(adminSb, customerId);
        if (!user && email) user = await findUserByEmail(adminSb, email);
        if (user) await setStatus(adminSb, user.id, 'past_due', null);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).send('Internal server error');
  }

  res.status(200).json({ received: true });
};

module.exports.config = {
  api: { bodyParser: false },
};
