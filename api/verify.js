module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { visitorId } = req.body;
  if (!visitorId) return res.status(200).json({ status: 'free', remaining: 1 });

  if (visitorId === 'daniel_admin_founding') {
    return res.status(200).json({ status: 'paid', plan: 'founding' });
  }

  try {
    const baseUrl = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    // Check if subscriber
    const subRes = await fetch(`${baseUrl}/get/sub:${visitorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const subData = await subRes.json();
    if (subData.result) {
      return res.status(200).json({ status: 'paid', plan: subData.result });
    }

    // Check pay-per-reading credits
    const credRes = await fetch(`${baseUrl}/get/credits:${visitorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const credData = await credRes.json();
    const credits = parseInt(credData.result || '0');
    if (credits > 0) {
      return res.status(200).json({ status: 'credits', remaining: credits });
    }

    // Check free readings used
    const freeRes = await fetch(`${baseUrl}/get/free:${visitorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const freeData = await freeRes.json();
    const used = parseInt(freeData.result || '0');
    if (used >= 1) {
      return res.status(200).json({ status: 'limit', remaining: 0 });
    }

    return res.status(200).json({ status: 'free', remaining: 1 - used });
  } catch (err) {
    return res.status(200).json({ status: 'free', remaining: 1 });
  }
};
