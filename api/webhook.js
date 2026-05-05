module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    return res.status(400).json({ error: 'Webhook verification failed' });
  }

  const baseUrl = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const visitorId = session.metadata?.visitorId;
    const priceId = session.metadata?.priceId;

    if (visitorId) {
      // Determine plan
      let plan = 'single';
      if (priceId === 'price_1TTY8RELsv6hW8wtJIU52NmH') plan = 'founding';
      if (priceId === 'price_1TTYEIELsv6hW8wt6MO7Bo5X') plan = 'standard';
      if (priceId === 'price_1TTYH0ELsv6hW8wtovLUa04H') plan = 'double';

      if (plan === 'founding' || plan === 'standard') {
        // Subscription — store indefinitely
        await fetch(`${baseUrl}/set/sub:${visitorId}/${plan}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Increment subscriber count
        await fetch(`${baseUrl}/incr/total_subscribers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Pay per reading — store credits
        const credits = plan === 'double' ? 2 : 1;
        await fetch(`${baseUrl}/incrby/credits:${visitorId}/${credits}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    }
  }

  res.status(200).json({ received: true });
};
