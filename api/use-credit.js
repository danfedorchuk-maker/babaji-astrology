module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { visitorId } = req.body;
  if (!visitorId) return res.status(400).json({ error: 'No visitorId' });

  try {
    const baseUrl = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    await fetch(`${baseUrl}/decrby/credits:${visitorId}/1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ error: err.message });
  }
};
