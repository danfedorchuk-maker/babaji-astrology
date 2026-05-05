module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const { priceId, visitorId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: priceId === 'price_1TTY8RELsv6hW8wtJIU52NmH' || 
            priceId === 'price_1TTYEIELsv6hW8wt6MO7Bo5X' 
            ? 'subscription' : 'payment',
      success_url: `https://babaji-astrology.vercel.app/?paid=true&session_id={CHECKOUT_SESSION_ID}&vid=${visitorId}`,
      cancel_url: `https://babaji-astrology.vercel.app/?cancelled=true`,
      metadata: { visitorId, priceId }
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(200).json({ error: err.message });
  }
};
