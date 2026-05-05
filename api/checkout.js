module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { priceId, visitorId } = req.body;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  const isSubscription = priceId === 'price_1TTY8RELsv6hW8wtJIU52NmH' || 
                         priceId === 'price_1TTYEIELsv6hW8wt6MO7Bo5X';

  const params = new URLSearchParams({
    'payment_method_types[]': 'card',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'mode': isSubscription ? 'subscription' : 'payment',
    'success_url': `https://babaji-astrology.vercel.app/?paid=true&vid=${visitorId}`,
    'cancel_url': 'https://babaji-astrology.vercel.app/?cancelled=true',
    'metadata[visitorId]': visitorId,
    'metadata[priceId]': priceId
  });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ error: data.error.message });
    }

    res.status(200).json({ url: data.url });
  } catch (err) {
    res.status(200).json({ error: err.message });
  }
};
