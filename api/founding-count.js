module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const baseUrl = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    const countRes = await fetch(`${baseUrl}/get/total_subscribers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await countRes.json();
    res.status(200).json({ count: data.result || '0' });
  } catch (err) {
    res.status(200).json({ count: '0' });
  }
};
